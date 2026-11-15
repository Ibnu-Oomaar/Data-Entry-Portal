import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Assessment } from '../assessments/assessment.entity';
import { ListStatus } from '../common/constants/assessment';
import { AppException } from '../common/errors/app.exception';
import { PaginatedResult } from '../common/pagination';
import { escapeLike } from '../common/utils/normalize';
import { NAME_ORDER_SQL, OrderEntry, applyOrder } from '../common/utils/order';
import { ListStudentsDto, StudentSortField } from './dto/list-students.dto';
import { Student } from './student.entity';

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
  constructor(@InjectRepository(Student) private readonly repo: Repository<Student>) {}

  findBySchoolId(studentId: number): Promise<Student | null> {
    return this.repo.findOne({ where: { studentId } });
  }

  async findBySchoolIdOrFail(studentId: number): Promise<Student> {
    const student = await this.findBySchoolId(studentId);
    if (!student) throw new AppException(HttpStatus.NOT_FOUND, 'STUDENT_NOT_FOUND', `No student with ID ${studentId}.`);
    return student;
  }

  findById(id: string): Promise<Student | null> {
    return this.repo.findOne({ where: { id } });
  }

  private filtered(q: Pick<ListStudentsDto, 'classLevel' | 'section' | 'status' | 'search'>): SelectQueryBuilder<Student> {
    const qb = this.repo
      .createQueryBuilder('s')
      .leftJoin(Assessment, 'a', 'a.student_id = s.id');
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

  async list(q: ListStudentsDto): Promise<PaginatedResult<StudentListItem>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const dir = (q.sortDir ?? 'asc').toUpperCase() as 'ASC' | 'DESC';

    const total = await this.filtered(q).getCount();

    const qb = this.filtered(q)
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
    applyOrder(qb, [
      ...primary,
      ['s.class_level', 'ASC'],
      ['s.section', 'ASC'],
      [NAME_ORDER_SQL, 'ASC'],
      ['s.student_id', 'ASC'],
    ]);
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

  /**
   * Class → section classification with real counts. Drives the class/section filters and the
   * dashboard overview. Completed = all seven components entered; in progress = some entered.
   */
  async structure(): Promise<ClassSummary[]> {
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
        LEFT JOIN assessments a ON a.student_id = s.id
       GROUP BY s.class_level, s.section
       ORDER BY s.class_level, s.section`);

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
}
