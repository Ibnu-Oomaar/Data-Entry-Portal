
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('teachers')
@Unique('uq_teachers_normalized_name', ['normalizedName'])
export class Teacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Name exactly as the administrator provisioned it (whitespace cleaned). */
  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  /** Lower-cased, whitespace-collapsed copy used for login matching. Unique => no ambiguous logins. */
  @Column({ name: 'normalized_name', type: 'varchar', length: 150 })
  normalizedName: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
