import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';
import { COMPONENT_KEYS, ComponentKey, MarksInput } from '../common/constants/assessment';
import { createExcelWorkbook } from '../common/excel-workbook';
import { AppException } from '../common/errors/app.exception';
import { PaginatedResult } from '../common/pagination';
import { assertGroupLimits, computeAssessment, sameMarks } from '../common/utils/marks';
import { escapeLike } from '../common/utils/normalize';
import { NAME_ORDER_SQL, applyOrder } from '../common/utils/order';
import { ListStudentsDto } from '../students/dto/list-students.dto';
import { StudentsService } from '../students/students.service';
import { TeacherClassSection } from '../teachers/teacher-class-section.entity';
import { Assessment } from './assessment.entity';
import { AssessmentView, StudentSummary, marksOf, toAssessmentView, toStudentSummary } from './assessment.view';
import { SaveAssessmentDto } from './dto/save-assessment.dto';

export interface StudentAssessment {
  student: StudentSummary;
  assessment: AssessmentView | null;
}

export interface SaveResult extends StudentAssessment {
  created: boolean;
  unchanged: boolean;
}

export interface AssessmentRecordRow {
  studentId: number;
  name: string;
  classLevel: number;
  section: string;
  marks: MarksInput;
  totalMarks: number;
  status: 'draft' | 'submitted';
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface PersistOutcome {
  id: string;
  created: boolean;
  unchanged: boolean;
}

const isUniqueViolation = (err: unknown) =>
  err instanceof QueryFailedError && (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505';

const snake = (k: string) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

const RECORD_SORT_SQL: Record<string, string> = {
  updatedAt: 'a.updated_at',
  studentId: 's.student_id',
  name: 's.name',
  classLevel: 's.class_level',
  section: 's.section',
  totalMarks: 'a.total_marks',
  status: 'a.status',
};

@Injectable()
export class AssessmentsService {
  constructor(
    @InjectRepository(Assessment) private readonly repo: Repository<Assessment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly students: StudentsService,
  ) {}

  /** Teacher view of one student: identity + current assessment (or null if nothing is entered yet). */
  async getForTeacher(
    studentId: number,
    teacherId: string,
    classLevel?: number,
    section?: string,
  ): Promise<StudentAssessment> {
    const student = await this.students.findTeacherSelectedStudent(studentId, teacherId, classLevel, section);
    const a = await this.repo.findOne({
      where: { studentRefId: student.id, teacherRefId: teacherId },
      relations: { createdBy: true, updatedBy: true },
    });
    return { student: toStudentSummary(student), assessment: a ? toAssessmentView(a, { audit: true }) : null };
  }

  /** Student view of their own record. The student comes from the session — never from the URL. */
  async getOwn(studentRefId: string): Promise<StudentAssessment> {
    const student = await this.students.findById(studentRefId);
    if (!student) throw new AppException(HttpStatus.NOT_FOUND, 'STUDENT_NOT_FOUND', 'Student record not found.');
    const [a] = await this.repo.find({ where: { studentRefId: student.id }, order: { updatedAt: 'DESC' }, take: 1 });
    return { student: toStudentSummary(student), assessment: a ? toAssessmentView(a, { audit: false }) : null };
  }

  /**
   * Create or update the single assessment for a student.
   * - Totals and status are computed here from the seven components (the client's totals are ignored).
   * - A teacher-owned row lock + version check stops one teacher silently overwriting their own data.
   * - Re-sending identical marks (double click, retry) is a harmless no-op.
   */
  async save(
    studentId: number,
    dto: SaveAssessmentDto,
    teacherId: string,
    classLevel?: number,
    section?: string,
  ): Promise<SaveResult> {
    const student = await this.students.findTeacherSelectedStudent(studentId, teacherId, classLevel, section);
    const marks = {} as MarksInput;
    for (const k of COMPONENT_KEYS) marks[k] = dto[k as ComponentKey];
    const computed = computeAssessment(marks);
    if (computed.enteredCount === 0) {
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, 'NO_MARKS', 'Enter at least one mark before saving.');
    }
    assertGroupLimits(computed);
    const expectedVersion = dto.expectedVersion ?? null;

    let outcome: PersistOutcome;
    try {
      outcome = await this.persist(student.id, marks, computed, expectedVersion, teacherId);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Two requests tried to create the same first record at once. Retry once: the loser now sees the
      // winner's row, so identical re-submits become a no-op and different data becomes a clear conflict.
      try {
        outcome = await this.persist(student.id, marks, computed, expectedVersion, teacherId);
      } catch (err2) {
        if (!isUniqueViolation(err2)) throw err2;
        throw new AppException(HttpStatus.CONFLICT, 'STALE_ASSESSMENT', 'Marks for this student were just saved by someone else. Reload and try again.');
      }
    }

    const fresh = await this.repo.findOneOrFail({ where: { id: outcome.id }, relations: { createdBy: true, updatedBy: true } });
    return {
      student: toStudentSummary(student),
      assessment: toAssessmentView(fresh, { audit: true }),
      created: outcome.created,
      unchanged: outcome.unchanged,
    };
  }

  private persist(
    studentRefId: string,
    marks: MarksInput,
    computed: ReturnType<typeof computeAssessment>,
    expectedVersion: number | null,
    teacherId: string,
  ): Promise<PersistOutcome> {
    return this.dataSource.transaction(async (em) => {
      const repo = em.getRepository(Assessment);
      const existing = await repo.findOne({
        where: { studentRefId, teacherRefId: teacherId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!existing) {
        if (expectedVersion !== null) {
          throw new AppException(HttpStatus.CONFLICT, 'STALE_ASSESSMENT', 'This assessment changed since you opened it. Reload and try again.');
        }
        const created = await repo.save(
          repo.create({
            studentRefId,
            teacherRefId: teacherId,
            ...marks,
            totalMarks: computed.totalMarks,
            status: computed.status,
            version: 1,
            createdByRefId: teacherId,
            updatedByRefId: teacherId,
          }),
        );
        return { id: created.id, created: true, unchanged: false };
      }

      if (sameMarks(marksOf(existing), marks)) return { id: existing.id, created: false, unchanged: true };

      if (expectedVersion !== existing.version) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'STALE_ASSESSMENT',
          'Another teacher saved newer marks for this student. Reload to see them before editing.',
        );
      }
      Object.assign(existing, marks, {
        totalMarks: computed.totalMarks,
        status: computed.status,
        version: existing.version + 1,
        updatedByRefId: teacherId,
      });
      await repo.save(existing);
      return { id: existing.id, created: false, unchanged: false };
    });
  }

  /** Assessment records page: students who have marks entered, with all seven components and audit info. */
  private filtered(q: ListStudentsDto, teacherId: string): SelectQueryBuilder<Assessment> {
    const qb = this.repo
      .createQueryBuilder('a')
      .innerJoin('a.student', 's')
      .innerJoin(
        TeacherClassSection,
        'access',
        'access.class_level = s.class_level AND access.section = s.section AND access.teacher_id = :teacherId',
        { teacherId },
      )
      .andWhere('a.teacher_id = :teacherId')
      .innerJoin('a.createdBy', 'cb')
      .innerJoin('a.updatedBy', 'ub');
    if (q.classLevel !== undefined) qb.andWhere('s.class_level = :classLevel', { classLevel: q.classLevel });
    if (q.section) qb.andWhere('s.section = :section', { section: q.section });
    if (q.status === 'pending') qb.andWhere('1 = 0');
    else if (q.status) qb.andWhere('a.status = :status', { status: q.status });
    if (q.search) {
      const term = `%${escapeLike(q.search)}%`;
      qb.andWhere(`(s.name ILIKE :term ESCAPE '\\' OR CAST(s.student_id AS TEXT) LIKE :term ESCAPE '\\')`, { term });
    }
    return qb;
  }

  private selectRecordColumns(qb: SelectQueryBuilder<Assessment>): void {
    qb.select('s.student_id', 'studentId')
      .addSelect('s.name', 'name')
      .addSelect('s.class_level', 'classLevel')
      .addSelect('s.section', 'section')
      .addSelect('a.total_marks', 'totalMarks')
      .addSelect('a.status', 'status')
      .addSelect('a.version', 'version')
      .addSelect('cb.full_name', 'createdBy')
      .addSelect('ub.full_name', 'updatedBy')
      .addSelect('a.created_at', 'createdAt')
      .addSelect('a.updated_at', 'updatedAt');
    for (const k of COMPONENT_KEYS) qb.addSelect(`a.${snake(k)}`, k);
  }

  private orderRecords(qb: SelectQueryBuilder<Assessment>, sortBy: string, dir: 'ASC' | 'DESC'): void {
    applyOrder(qb, [
      [sortBy === 'name' ? NAME_ORDER_SQL : RECORD_SORT_SQL[sortBy], dir, sortBy === 'totalMarks' ? 'NULLS LAST' : undefined],
      ['s.class_level', 'ASC'],
      ['s.section', 'ASC'],
      [NAME_ORDER_SQL, 'ASC'],
      ['s.student_id', 'ASC'],
    ]);
  }

  async list(q: ListStudentsDto, teacherId: string): Promise<PaginatedResult<AssessmentRecordRow>> {
    await this.students.ensureTeacherFilterAccess(teacherId, q.classLevel, q.section);
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 25;
    const sortBy = q.sortBy && q.sortBy !== 'classSection' ? q.sortBy : 'updatedAt';
    const dir = (q.sortDir ?? (sortBy === 'updatedAt' ? 'desc' : 'asc')).toUpperCase() as 'ASC' | 'DESC';

    const total = await this.filtered(q, teacherId).getCount();
    const qb = this.filtered(q, teacherId);
    this.selectRecordColumns(qb);
    this.orderRecords(qb, sortBy, dir);
    qb.offset((page - 1) * pageSize).limit(pageSize);

    const rows = await qb.getRawMany();
    const items = rows.map((r): AssessmentRecordRow => {
      const marks = {} as MarksInput;
      for (const k of COMPONENT_KEYS) marks[k] = r[k] === null ? null : parseFloat(r[k]);
      return {
        studentId: Number(r.studentId),
        name: r.name,
        classLevel: Number(r.classLevel),
        section: r.section,
        marks,
        totalMarks: parseFloat(r.totalMarks),
        status: r.status,
        version: Number(r.version),
        createdBy: r.createdBy,
        updatedBy: r.updatedBy,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),
      };
    });
    return new PaginatedResult(items, total, page, pageSize);
  }

  async export(q: ListStudentsDto, teacherId: string): Promise<Buffer> {
    if (q.classLevel === undefined || q.section === undefined) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CLASS_SECTION_REQUIRED',
        'Select a class and section before exporting assessment records.',
      );
    }
    await this.students.ensureTeacherFilterAccess(teacherId, q.classLevel, q.section);
    const sortBy = q.sortBy && q.sortBy !== 'classSection' ? q.sortBy : 'updatedAt';
    const dir = (q.sortDir ?? (sortBy === 'updatedAt' ? 'desc' : 'asc')).toUpperCase() as 'ASC' | 'DESC';
    const qb = this.filtered(q, teacherId);
    this.selectRecordColumns(qb);
    this.orderRecords(qb, sortBy, dir);
    const rows = await qb.getRawMany();
    const columns = [
      { header: 'Student ID', key: 'studentId', width: 14 },
      { header: 'Student name', key: 'name', width: 32 },
      { header: 'Class', key: 'classLevel', width: 10 },
      { header: 'Section', key: 'section', width: 10 },
      ...COMPONENT_KEYS.map((key) => ({ header: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), key, width: 20 })),
      { header: 'Total marks', key: 'totalMarks', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Created by', key: 'createdBy', width: 22 },
      { header: 'Updated by', key: 'updatedBy', width: 22 },
      { header: 'Created at', key: 'createdAt', width: 24 },
      { header: 'Updated at', key: 'updatedAt', width: 24 },
      { header: 'Version', key: 'version', width: 12 },
    ];
    const data = rows.map((row): Record<string, string | number | null> => {
      const item: Record<string, string | number | null> = {
        studentId: Number(row.studentId),
        name: row.name,
        classLevel: Number(row.classLevel),
        section: row.section,
        totalMarks: Number(row.totalMarks),
        status: row.status,
        createdBy: row.createdBy,
        updatedBy: row.updatedBy,
        createdAt: new Date(row.createdAt).toISOString(),
        updatedAt: new Date(row.updatedAt).toISOString(),
        version: Number(row.version),
      };
      for (const key of COMPONENT_KEYS) item[key] = row[key] == null ? null : Number(row[key]);
      return item;
    });
    return createExcelWorkbook('Assessments', columns, data);
  }

  exportFilename(q: Pick<ListStudentsDto, 'classLevel' | 'section'>): string {
    return `assessments${q.classLevel ? `-class-${q.classLevel}` : ''}${q.section ? `-section-${q.section}` : ''}.xlsx`;
  }
}
