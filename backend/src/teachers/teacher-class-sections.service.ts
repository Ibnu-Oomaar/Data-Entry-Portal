import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { normalizePersonName } from '../common/utils/normalize';
import { Student } from '../students/student.entity';
import { Teacher } from './teacher.entity';
import { TeacherClassSection } from './teacher-class-section.entity';

@Injectable()
export class TeacherClassSectionsService {
  constructor(
    @InjectRepository(TeacherClassSection) private readonly assignments: Repository<TeacherClassSection>,
    @InjectRepository(Teacher) private readonly teachers: Repository<Teacher>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
  ) {}

  async hasAccess(teacherId: string, classLevel: number, section: string): Promise<boolean> {
    return this.assignments.existsBy({ teacherRefId: teacherId, classLevel, section });
  }

  async assertFilterAccess(teacherId: string, classLevel?: number, section?: string): Promise<void> {
    if (classLevel === undefined && section === undefined) return;
    if (section !== undefined && classLevel === undefined) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CLASS_REQUIRED',
        'Select a class before filtering by section.',
      );
    }
    if (classLevel !== undefined && section !== undefined && !(await this.students.existsBy({ classLevel, section }))) return;
    const qb = this.assignments.createQueryBuilder('assignment').where('assignment.teacher_id = :teacherId', { teacherId });
    if (classLevel !== undefined) qb.andWhere('assignment.class_level = :classLevel', { classLevel });
    if (section !== undefined) qb.andWhere('assignment.section = :section', { section });
    if (!(await qb.getExists())) {
      throw new AppException(HttpStatus.FORBIDDEN, 'CLASS_ACCESS_DENIED', 'You do not have permission to access that class or section.');
    }
  }

  async assertStudentAccess(teacherId: string, student: Pick<Student, 'classLevel' | 'section'>): Promise<void> {
    if (!(await this.hasAccess(teacherId, student.classLevel, student.section))) {
      throw new AppException(HttpStatus.NOT_FOUND, 'STUDENT_NOT_FOUND', 'Student record not found.');
    }
  }

  async list(): Promise<Array<{ classLevel: number; section: string; teacherName: string | null }>> {
    const roster = await this.students
      .createQueryBuilder('student')
      .select('student.class_level', 'classLevel')
      .addSelect('student.section', 'section')
      .addSelect('teacher.full_name', 'teacherName')
      .leftJoin(
        TeacherClassSection,
        'assignment',
        'assignment.class_level = student.class_level AND assignment.section = student.section',
      )
      .leftJoin(Teacher, 'teacher', 'teacher.id = assignment.teacher_id')
      .distinct(true)
      .orderBy('student.class_level', 'ASC')
      .addOrderBy('student.section', 'ASC')
      .addOrderBy('teacher.full_name', 'ASC');
    return roster.getRawMany();
  }

  async assign(rawName: string, classLevel: number, section: string): Promise<void> {
    const teacher = await this.teachers.findOne({ where: { normalizedName: normalizePersonName(rawName) } });
    if (!teacher) throw new AppException(HttpStatus.NOT_FOUND, 'TEACHER_NOT_FOUND', `No teacher named "${rawName}".`);

    if (!(await this.students.existsBy({ classLevel, section }))) {
      throw new AppException(HttpStatus.NOT_FOUND, 'CLASS_SECTION_NOT_FOUND', `Class ${classLevel}, section ${section} does not exist in the student roster.`);
    }
    if (await this.assignments.existsBy({ classLevel, section, teacherRefId: teacher.id })) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'CLASS_SECTION_ASSIGNED',
        `Class ${classLevel}, section ${section} is already assigned to ${teacher.fullName}.`,
      );
    }
    await this.assignments.save(this.assignments.create({ classLevel, section, teacherRefId: teacher.id }));
  }

  async unassign(rawName: string, classLevel: number, section: string): Promise<void> {
    const teacher = await this.teachers.findOne({ where: { normalizedName: normalizePersonName(rawName) } });
    if (!teacher) throw new AppException(HttpStatus.NOT_FOUND, 'TEACHER_NOT_FOUND', `No teacher named "${rawName}".`);
    const assignment = await this.assignments.findOne({ where: { classLevel, section, teacherRefId: teacher.id } });
    if (!assignment) {
      throw new AppException(HttpStatus.NOT_FOUND, 'CLASS_SECTION_ASSIGNMENT_NOT_FOUND', `Class ${classLevel}, section ${section} is not assigned to ${teacher.fullName}.`);
    }
    await this.assignments.remove(assignment);
  }
}
