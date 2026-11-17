import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Teacher } from './teacher.entity';

@Entity('teacher_passkeys')
@Index('uq_teacher_passkeys_credential_id', ['credentialId'], { unique: true })
@Index('idx_teacher_passkeys_teacher_id', ['teacherRefId'])
export class TeacherPasskey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherRefId: string;

  @ManyToOne(() => Teacher, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: Relation<Teacher>;

  @Column({ name: 'credential_id', type: 'varchar', length: 1024 })
  credentialId: string;

  @Column({ name: 'public_key', type: 'bytea' })
  publicKey: Buffer;

  @Column({
    type: 'bigint',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  counter: number;

  @Column({ type: 'text', array: true, default: '{}' })
  transports: string[];

  @Column({ name: 'device_type', type: 'varchar', length: 32 })
  deviceType: string;

  @Column({ name: 'backed_up', type: 'boolean', default: false })
  backedUp: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
