import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Student } from '../students/student.entity';
import { Teacher } from '../teachers/teacher.entity';
import type { AssessmentStatus } from '../common/constants/assessment';

/** PostgreSQL returns NUMERIC as string; the API works with numbers. */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? null : parseFloat(value)),
};

const mark = (name: string) =>
  Column({ name, type: 'numeric', precision: 4, scale: 2, nullable: true, transformer: numericTransformer });

/**
 * One assessment per teacher and student. A teacher's assessment is private to its owner.
 * NULL = not entered yet, 0 = entered as zero.
 */
@Entity('assessments')
@Unique('uq_assessments_student_teacher', ['studentRefId', 'teacherRefId'])
@Index('idx_assessments_status', ['status'])
@Index('idx_assessments_updated_at', ['updatedAt'])
@Index('idx_assessments_teacher_updated_at', ['teacherRefId', 'updatedAt'])
@Check(
  'chk_assessments_mark_ranges',
  `("chapter1_notes" IS NULL OR "chapter1_notes" BETWEEN 0 AND 2)
   AND ("chapter1_exercises" IS NULL OR "chapter1_exercises" BETWEEN 0 AND 6)
   AND ("chapter1_assignment" IS NULL OR "chapter1_assignment" BETWEEN 0 AND 5)
   AND ("chapter2_notes" IS NULL OR "chapter2_notes" BETWEEN 0 AND 2)
   AND ("chapter2_exercises" IS NULL OR "chapter2_exercises" BETWEEN 0 AND 6)
   AND ("chapter2_assignment" IS NULL OR "chapter2_assignment" BETWEEN 0 AND 5)
   AND ("textbook" IS NULL OR "textbook" BETWEEN 0 AND 4)`,
)
@Check(
  'chk_assessments_total_matches',
  `"total_marks" BETWEEN 0 AND 30 AND "total_marks" = COALESCE("chapter1_notes",0) + COALESCE("chapter1_exercises",0) + COALESCE("chapter1_assignment",0) + COALESCE("chapter2_notes",0) + COALESCE("chapter2_exercises",0) + COALESCE("chapter2_assignment",0) + COALESCE("textbook",0)`,
)
@Check('chk_assessments_status_values', `"status" IN ('draft','submitted')`)
@Check(
  'chk_assessments_status_matches_marks',
  `("status" = 'submitted') = ("chapter1_notes" IS NOT NULL AND "chapter1_exercises" IS NOT NULL AND "chapter1_assignment" IS NOT NULL AND "chapter2_notes" IS NOT NULL AND "chapter2_exercises" IS NOT NULL AND "chapter2_assignment" IS NOT NULL AND "textbook" IS NOT NULL)`,
)
export class Assessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentRefId: string;

  @ManyToOne(() => Student, (s) => s.assessments, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student: Relation<Student>;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherRefId: string;

  @ManyToOne(() => Teacher, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: Relation<Teacher>;

  @mark('chapter1_notes') chapter1Notes: number | null;
  @mark('chapter1_exercises') chapter1Exercises: number | null;
  @mark('chapter1_assignment') chapter1Assignment: number | null;
  @mark('chapter2_notes') chapter2Notes: number | null;
  @mark('chapter2_exercises') chapter2Exercises: number | null;
  @mark('chapter2_assignment') chapter2Assignment: number | null;
  @mark('textbook') textbook: number | null;

  /** Always recomputed on the server; a CHECK constraint guarantees it matches the components. */
  @Column({
    name: 'total_marks',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalMarks: number;

  @Column({ type: 'varchar', length: 12, default: 'draft' })
  status: AssessmentStatus;

  /** Optimistic-concurrency counter: incremented on every change. */
  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({ name: 'created_by', type: 'uuid' })
  createdByRefId: string;

  @ManyToOne(() => Teacher, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  createdBy: Relation<Teacher>;

  @Column({ name: 'updated_by', type: 'uuid' })
  updatedByRefId: string;

  @ManyToOne(() => Teacher, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'updated_by' })
  updatedBy: Relation<Teacher>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
