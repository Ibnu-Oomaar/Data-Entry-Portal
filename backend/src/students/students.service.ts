import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { createExcelWorkbook } from '../common/excel-workbook';
import { Assessment } from '../assessments/assessment.entity';
import { ListStatus } from '../common/constants/assessment';
import { AppException } from '../common/errors/app.exception';
import { PaginatedResult } from '../common/pagination';
import { escapeLike } from '../common/utils/normalize';
import { NAME_ORDER_SQL, OrderEntry, applyOrder } from '../common/utils/order';
import { ListStudentsDto, StudentSortField } from './dto/list-students.dto';
import { Student } from './student.entity';
import { TeacherClassSection } from '../teachers/teacher-class-section.entity';
import { TeacherClassSectionsService } from '../teachers/teacher-class-sections.service';

export interface StudentListItem {
  studentId: number;
  name: string;
  classLevel: number;
  section: string;
  status: ListStatus;
  totalMarks: number | null;
  version: number | null;
  updatedAt: string | null;
}

export interface SectionSummary {
  section: string;
  students: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  average: number | null;
}

export interface ClassSummary {
  classLevel: number;
  students: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  average: number | null;
  sections: SectionSummary[];
}

/** SQL expressions per sortable field. Only whitelisted keys ever reach the query. */
const SORT_SQL: Record<Exclude<StudentSortField, 'classSection'>, string> = {
  studentId: 's.student_id',
  name: 's.name',
  classLevel: 's.class_level',
  section: 's.section',
  totalMarks: 'a.total_marks',
  updatedAt: 'a.updated_at',
  status: `CASE COALESCE(a.status,'pending') WHEN 'pending' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END`,
};

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student) private readonly repo: Repository<Student>,
    private readonly assignments: TeacherClassSectionsService,
  ) {}

  findBySchoolId(studentId: number): Promise<Student | null> {
    return this.repo.findOne({ where: { studentId } });
  }

  async findBySchoolIdOrFail(studentId: number): Promise<Student> {
    const student = await this.findBySchoolId(studentId);
    if (!student) throw new AppException(HttpStatus.NOT_FOUND, 'STUDENT_NOT_FOUND', `No student with ID ${studentId}.`);
    return student;
  }

  async assertTeacherAccess(student: Student, teacherId: string): Promise<void> {
    await this.assignments.assertStudentAccess(teacherId, student);
  }

  async findTeacherSelectedStudent(
    studentId: number,
    teacherId: string,
    classLevel?: number,
    section?: string,
  ): Promise<Student> {
    if (classLevel === undefined || section === undefined) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CLASS_SECTION_REQUIRED',
        'Select a class and section before accessing student marks.',
      );
    }
    const student = await this.findBySchoolIdOrFail(studentId);
    if (student.classLevel !== classLevel || student.section !== section) {
      throw new AppException(HttpStatus.NOT_FOUND, 'STUDENT_NOT_FOUND', 'Student record not found.');
    }
    await this.assertTeacherAccess(student, teacherId);
    return student;
  }

  ensureTeacherFilterAccess(teacherId: string, classLevel?: number, section?: string): Promise<void> {
    return this.assignments.assertFilterAccess(teacherId, classLevel, section);
  }

  findById(id: string): Promise<Student | null> {
    return this.repo.findOne({ where: { id } });
  }

  private filtered(
    q: Pick<ListStudentsDto, 'classLevel' | 'section' | 'status' | 'search'>,
    teacherId: string,
  ): SelectQueryBuilder<Student> {
    const qb = this.repo
      .createQueryBuilder('s')
      .innerJoin(
        TeacherClassSection,
        'access',
        'access.class_level = s.class_level AND access.section = s.section AND access.teacher_id = :teacherId',
        { teacherId },
      )
      .leftJoin(Assessment, 'a', 'a.student_id = s.id AND a.teacher_id = :teacherId', { teacherId });
    if (q.classLevel !== undefined) qb.andWhere('s.class_level = :classLevel', { classLevel: q.classLevel });
    if (q.section) qb.andWhere('s.section = :section', { section: q.section });
    if (q.status === 'pending') qb.andWhere('a.id IS NULL');
    else if (q.status) qb.andWhere('a.status = :status', { status: q.status });
    if (q.search) {
      const term = `%${escapeLike(q.search)}%`;
      qb.andWhere(`(s.name ILIKE :term ESCAPE '\\' OR CAST(s.student_id AS TEXT) LIKE :term ESCAPE '\\')`, { term });
    }
    return qb;
  }

  async list(q: ListStudentsDto, teacherId: string): Promise<PaginatedResult<StudentListItem>> {
    await this.assignments.assertFilterAccess(teacherId, q.classLevel, q.section);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const dir = (q.sortDir ?? 'asc').toUpperCase() as 'ASC' | 'DESC';

    const total = await this.filtered(q, teacherId).getCount();

    const qb = this.filtered(q, teacherId)
      .select('s.student_id', 'studentId')
      .addSelect('s.name', 'name')
      .addSelect('s.class_level', 'classLevel')
      .addSelect('s.section', 'section')
      .addSelect(`COALESCE(a.status, 'pending')`, 'status')
      .addSelect('a.total_marks', 'totalMarks')
      .addSelect('a.version', 'version')
      .addSelect('a.updated_at', 'updatedAt');

    const sortBy = q.sortBy ?? 'classSection';
    const primary: OrderEntry[] =
      sortBy === 'classSection'
        ? // The "classified" order: by class, then section (same direction), then name.
          [['s.class_level', dir], ['s.section', dir]]
        : [[sortBy === 'name' ? NAME_ORDER_SQL : SORT_SQL[sortBy], dir, sortBy === 'totalMarks' ? 'NULLS LAST' : undefined]];
    this.orderStudents(qb, primary);
    qb.offset((page - 1) * pageSize).limit(pageSize);

    const rows = await qb.getRawMany();
    const items: StudentListItem[] = rows.map((r) => ({
      studentId: Number(r.studentId),
      name: r.name,
      classLevel: Number(r.classLevel),
      section: r.section,
      status: r.status,
      totalMarks: r.totalMarks === null ? null : parseFloat(r.totalMarks),
      version: r.version === null ? null : Number(r.version),
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
    }));
    return new PaginatedResult(items, total, page, pageSize);
  }

  async export(q: ListStudentsDto, teacherId: string): Promise<Buffer> {
    await this.assignments.assertFilterAccess(teacherId, q.classLevel, q.section);
    const qb = this.filtered(q, teacherId)
      .select('s.student_id', 'studentId')
      .addSelect('s.name', 'name')
      .addSelect('s.class_level', 'classLevel')
      .addSelect('s.section', 'section')
      .addSelect(`COALESCE(a.status, 'pending')`, 'status')
      .addSelect('a.chapter1_notes', 'chapter1Notes')
      .addSelect('a.chapter1_exercises', 'chapter1Exercises')
      .addSelect('a.chapter1_assignment', 'chapter1Assignment')
      .addSelect('a.chapter2_notes', 'chapter2Notes')
      .addSelect('a.chapter2_exercises', 'chapter2Exercises')
      .addSelect('a.chapter2_assignment', 'chapter2Assignment')
      .addSelect('a.textbook', 'textbook')
      .addSelect('a.total_marks', 'totalMarks');
    const sortBy = q.sortBy ?? 'classSection';
    const dir = (q.sortDir ?? 'asc').toUpperCase() as 'ASC' | 'DESC';
    const primary: OrderEntry[] =
      sortBy === 'classSection'
        ? [['s.class_level', dir], ['s.section', dir]]
        : [[sortBy === 'name' ? NAME_ORDER_SQL : SORT_SQL[sortBy], dir, sortBy === 'totalMarks' ? 'NULLS LAST' : undefined]];
    this.orderStudents(qb, primary);

    const rows = await qb.getRawMany();
    const numericColumns = [
      'chapter1Notes',
      'chapter1Exercises',
      'chapter1Assignment',
      'chapter2Notes',
      'chapter2Exercises',
      'chapter2Assignment',
      'textbook',
      'totalMarks',
    ] as const;
    const data = rows.map((row): Record<string, string | number | null> => {
      const output: Record<string, string | number | null> = {
        studentId: Number(row.studentId),
        name: row.name,
        classLevel: Number(row.classLevel),
        section: row.section,
        status: row.status,
      };
      for (const key of numericColumns) output[key] = row[key] == null ? null : Number(row[key]);
      return output;
    });

    return createExcelWorkbook(
      'Students',
      [
        { header: 'Student ID', key: 'studentId', width: 14 },
        { header: 'Student name', key: 'name', width: 32 },
        { header: 'Class', key: 'classLevel', width: 10 },
        { header: 'Section', key: 'section', width: 10 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Chapter 1 notes', key: 'chapter1Notes', width: 18 },
        { header: 'Chapter 1 exercises', key: 'chapter1Exercises', width: 22 },
        { header: 'Chapter 1 assignment', key: 'chapter1Assignment', width: 22 },
        { header: 'Chapter 2 notes', key: 'chapter2Notes', width: 18 },
        { header: 'Chapter 2 exercises', key: 'chapter2Exercises', width: 22 },
        { header: 'Chapter 2 assignment', key: 'chapter2Assignment', width: 22 },
        { header: 'Textbook', key: 'textbook', width: 12 },
        { header: 'Total marks', key: 'totalMarks', width: 14 },
      ],
      data,
    );
  }

  exportFilename(q: Pick<ListStudentsDto, 'classLevel' | 'section'>): string {
    return `students${q.classLevel ? `-class-${q.classLevel}` : ''}${q.section ? `-section-${q.section}` : ''}.xlsx`;
  }

  /**
   * Class → section classification with real counts. Drives the class/section filters and the
   * dashboard overview. Completed = all seven components entered; in progress = some entered.
   */
  async structure(teacherId: string): Promise<ClassSummary[]> {
    const rows: Array<{
      class_level: number;
      section: string;
      students: string;
      completed: string;
      in_progress: string;
      sum_marks: string | null;
    }> = await this.repo.query(`
      SELECT s.class_level, s.section,
             COUNT(*)                                          AS students,
             COUNT(*) FILTER (WHERE a.status = 'submitted')    AS completed,
             COUNT(*) FILTER (WHERE a.status = 'draft')        AS in_progress,
             SUM(a.total_marks) FILTER (WHERE a.status = 'submitted') AS sum_marks
        FROM students s
        INNER JOIN teacher_class_sections access
          ON access.class_level = s.class_level
         AND access.section = s.section
         AND access.teacher_id = $1
        LEFT JOIN assessments a ON a.student_id = s.id AND a.teacher_id = $1
       GROUP BY s.class_level, s.section
       ORDER BY s.class_level, s.section`, [teacherId]);

    const avg = (sum: number, n: number) => (n ? Math.round((sum / n) * 100) / 100 : null);
    const byClass = new Map<number, ClassSummary & { _sum: number }>();
    for (const r of rows) {
      const classLevel = Number(r.class_level);
      const students = Number(r.students);
      const completed = Number(r.completed);
      const inProgress = Number(r.in_progress);
      const sum = r.sum_marks === null ? 0 : parseFloat(r.sum_marks);
      let c = byClass.get(classLevel);
      if (!c) {
        c = { classLevel, students: 0, completed: 0, inProgress: 0, notStarted: 0, average: null, sections: [], _sum: 0 };
        byClass.set(classLevel, c);
      }
      c.students += students;
      c.completed += completed;
      c.inProgress += inProgress;
      c.notStarted += students - completed - inProgress;
      c._sum += sum;
      c.sections.push({
        section: r.section,
        students,
        completed,
        inProgress,
        notStarted: students - completed - inProgress,
        average: avg(sum, completed),
      });
    }
    return [...byClass.values()].map(({ _sum, ...c }) => ({ ...c, average: avg(_sum, c.completed) }));
  }

  private orderStudents(qb: SelectQueryBuilder<Student>, primary: OrderEntry[]): void {
    applyOrder(qb, [...primary, ['s.class_level', 'ASC'], ['s.section', 'ASC'], [NAME_ORDER_SQL, 'ASC'], ['s.student_id', 'ASC']]);
  }
}
