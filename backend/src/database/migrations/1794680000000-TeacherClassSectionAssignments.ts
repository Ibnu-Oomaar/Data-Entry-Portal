import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeacherClassSectionAssignments1794680000000 implements MigrationInterface {
  name = 'TeacherClassSectionAssignments1794680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "teacher_class_sections" ("class_level" smallint NOT NULL, "section" character varying(1) NOT NULL, "teacher_id" uuid NOT NULL, CONSTRAINT "PK_teacher_class_sections" PRIMARY KEY ("class_level", "section"), CONSTRAINT "chk_teacher_class_sections_class_level_positive" CHECK ("class_level" > 0), CONSTRAINT "chk_teacher_class_sections_section_letter" CHECK ("section" ~ '^[A-Z]$'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "teacher_class_sections" ADD CONSTRAINT "FK_teacher_class_sections_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`CREATE INDEX "idx_teacher_class_sections_teacher" ON "teacher_class_sections" ("teacher_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_teacher_class_sections_teacher"`);
    await queryRunner.query(`ALTER TABLE "teacher_class_sections" DROP CONSTRAINT "FK_teacher_class_sections_teacher"`);
    await queryRunner.query(`DROP TABLE "teacher_class_sections"`);
  }
}
