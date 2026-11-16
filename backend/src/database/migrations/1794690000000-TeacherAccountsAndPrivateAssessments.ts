import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeacherAccountsAndPrivateAssessments1794690000000 implements MigrationInterface {
  name = 'TeacherAccountsAndPrivateAssessments1794690000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "teachers" ADD "password_hash" character varying(200)`);

    await queryRunner.query(`ALTER TABLE "assessments" ADD "teacher_id" uuid`);
    await queryRunner.query(`UPDATE "assessments" SET "teacher_id" = "created_by"`);
    await queryRunner.query(`ALTER TABLE "assessments" ALTER COLUMN "teacher_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "REL_060c5cb0c29c986eabfd77c52d"`);
    await queryRunner.query(
      `ALTER TABLE "assessments" ADD CONSTRAINT "uq_assessments_student_teacher" UNIQUE ("student_id", "teacher_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessments" ADD CONSTRAINT "FK_assessments_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`CREATE INDEX "idx_assessments_teacher_updated_at" ON "assessments" ("teacher_id", "updated_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM "assessments" GROUP BY "student_id" HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Cannot restore one-assessment-per-student while teacher-owned records exist';
        END IF;
      END $$`);
    await queryRunner.query(`DROP INDEX "public"."idx_assessments_teacher_updated_at"`);
    await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_assessments_teacher"`);
    await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "uq_assessments_student_teacher"`);
    await queryRunner.query(
      `ALTER TABLE "assessments" ADD CONSTRAINT "REL_060c5cb0c29c986eabfd77c52d" UNIQUE ("student_id")`,
    );
    await queryRunner.query(`ALTER TABLE "assessments" DROP COLUMN "teacher_id"`);
    await queryRunner.query(`ALTER TABLE "teachers" DROP COLUMN "password_hash"`);
  }
}
