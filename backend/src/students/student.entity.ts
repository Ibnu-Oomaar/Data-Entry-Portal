import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Assessment } from '../assessments/assessment.entity';

@Entity('students')
@Unique('uq_students_student_id', ['studentId'])
@Index('idx_students_class_section', ['classLevel', 'section'])
@Check('chk_students_section_letter', `"section" ~ '^[A-Z]$'`)
@Check('chk_students_class_level_positive', `"class_level" > 0`)
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The school's own Student ID, preserved from the Excel workbook. Used for student login. */
  @Column({ name: 'student_id', type: 'integer' })
  studentId: number;

  /** Full name exactly as imported. Never rewritten by the import. */
  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'class_level', type: 'smallint' })
  classLevel: number;

  @Column({ type: 'varchar', length: 1 })
  section: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Assessment, (a) => a.student)
  assessments?: Relation<Assessment[]>;
}
