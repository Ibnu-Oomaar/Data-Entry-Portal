import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1794665581986 implements MigrationInterface {
    name = 'InitialSchema1794665581986'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "students" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "student_id" integer NOT NULL, "name" character varying(200) NOT NULL, "class_level" smallint NOT NULL, "section" character varying(1) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_students_student_id" UNIQUE ("student_id"), CONSTRAINT "chk_students_class_level_positive" CHECK ("class_level" > 0), CONSTRAINT "chk_students_section_letter" CHECK ("section" ~ '^[A-Z]$'), CONSTRAINT "PK_7d7f07271ad4ce999880713f05e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_students_class_section" ON "students" ("class_level", "section") `);
        await queryRunner.query(`CREATE TABLE "teachers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "full_name" character varying(150) NOT NULL, "normalized_name" character varying(150) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_teachers_normalized_name" UNIQUE ("normalized_name"), CONSTRAINT "PK_a8d4f83be3abe4c687b0a0093c8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "assessments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "student_id" uuid NOT NULL, "chapter1_notes" numeric(4,2), "chapter1_exercises" numeric(4,2), "chapter1_assignment" numeric(4,2), "chapter2_notes" numeric(4,2), "chapter2_exercises" numeric(4,2), "chapter2_assignment" numeric(4,2), "textbook" numeric(4,2), "total_marks" numeric(5,2) NOT NULL DEFAULT '0', "status" character varying(12) NOT NULL DEFAULT 'draft', "version" integer NOT NULL DEFAULT '1', "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_060c5cb0c29c986eabfd77c52d" UNIQUE ("student_id"), CONSTRAINT "chk_assessments_status_matches_marks" CHECK (("status" = 'submitted') = ("chapter1_notes" IS NOT NULL AND "chapter1_exercises" IS NOT NULL AND "chapter1_assignment" IS NOT NULL AND "chapter2_notes" IS NOT NULL AND "chapter2_exercises" IS NOT NULL AND "chapter2_assignment" IS NOT NULL AND "textbook" IS NOT NULL)), CONSTRAINT "chk_assessments_status_values" CHECK ("status" IN ('draft','submitted')), CONSTRAINT "chk_assessments_total_matches" CHECK ("total_marks" BETWEEN 0 AND 30 AND "total_marks" = COALESCE("chapter1_notes",0) + COALESCE("chapter1_exercises",0) + COALESCE("chapter1_assignment",0) + COALESCE("chapter2_notes",0) + COALESCE("chapter2_exercises",0) + COALESCE("chapter2_assignment",0) + COALESCE("textbook",0)), CONSTRAINT "chk_assessments_mark_ranges" CHECK (("chapter1_notes" IS NULL OR "chapter1_notes" BETWEEN 0 AND 2)
   AND ("chapter1_exercises" IS NULL OR "chapter1_exercises" BETWEEN 0 AND 6)
   AND ("chapter1_assignment" IS NULL OR "chapter1_assignment" BETWEEN 0 AND 5)
   AND ("chapter2_notes" IS NULL OR "chapter2_notes" BETWEEN 0 AND 2)
   AND ("chapter2_exercises" IS NULL OR "chapter2_exercises" BETWEEN 0 AND 6)
   AND ("chapter2_assignment" IS NULL OR "chapter2_assignment" BETWEEN 0 AND 5)
   AND ("textbook" IS NULL OR "textbook" BETWEEN 0 AND 4)), CONSTRAINT "PK_a3442bd80a00e9111cefca57f6c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_assessments_updated_at" ON "assessments" ("updated_at") `);
        await queryRunner.query(`CREATE INDEX "idx_assessments_status" ON "assessments" ("status") `);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_060c5cb0c29c986eabfd77c52d3" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_cba2d07506cc7a2033cb6b6b130" FOREIGN KEY ("created_by") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "assessments" ADD CONSTRAINT "FK_388e9f68341721d73692286aa45" FOREIGN KEY ("updated_by") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_388e9f68341721d73692286aa45"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_cba2d07506cc7a2033cb6b6b130"`);
        await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "FK_060c5cb0c29c986eabfd77c52d3"`);
        await queryRunner.query(`DROP INDEX "public"."idx_assessments_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_assessments_updated_at"`);
        await queryRunner.query(`DROP TABLE "assessments"`);
        await queryRunner.query(`DROP TABLE "teachers"`);
        await queryRunner.query(`DROP INDEX "public"."idx_students_class_section"`);
        await queryRunner.query(`DROP TABLE "students"`);
    }

}
