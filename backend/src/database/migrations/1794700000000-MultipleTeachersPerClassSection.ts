import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultipleTeachersPerClassSection1794700000000 implements MigrationInterface {
  name = 'MultipleTeachersPerClassSection1794700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "teacher_class_sections" DROP CONSTRAINT "PK_teacher_class_sections"`);
    await queryRunner.query(
      `ALTER TABLE "teacher_class_sections" ADD CONSTRAINT "PK_teacher_class_sections" PRIMARY KEY ("class_level", "section", "teacher_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const shared = await queryRunner.query(
      `SELECT 1 FROM "teacher_class_sections" GROUP BY "class_level", "section" HAVING COUNT(*) > 1 LIMIT 1`,
    );
    if (shared.length) {
      throw new Error('Cannot restore one-owner-per-section constraint while sections are assigned to multiple teachers.');
    }

    await queryRunner.query(`ALTER TABLE "teacher_class_sections" DROP CONSTRAINT "PK_teacher_class_sections"`);
    await queryRunner.query(
      `ALTER TABLE "teacher_class_sections" ADD CONSTRAINT "PK_teacher_class_sections" PRIMARY KEY ("class_level", "section")`,
    );
  }
}
