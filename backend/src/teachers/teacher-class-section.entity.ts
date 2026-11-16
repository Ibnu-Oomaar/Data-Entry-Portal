import { Check, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Teacher } from './teacher.entity';

@Entity('teacher_class_sections')
@Check('chk_teacher_class_sections_class_level_positive', '"class_level" > 0')
@Check('chk_teacher_class_sections_section_letter', `"section" ~ '^[A-Z]$'`)
export class TeacherClassSection {
  @PrimaryColumn({ name: 'class_level', type: 'smallint' })
  classLevel: number;

  @PrimaryColumn({ type: 'varchar', length: 1 })
  section: string;

  @PrimaryColumn({ name: 'teacher_id', type: 'uuid' })
  teacherRefId: string;

  @ManyToOne(() => Teacher, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: Relation<Teacher>;
}
