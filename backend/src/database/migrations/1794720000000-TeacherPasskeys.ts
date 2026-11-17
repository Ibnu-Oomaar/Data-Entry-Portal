import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeacherPasskeys1794720000000 implements MigrationInterface {
  name = 'TeacherPasskeys1794720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "teacher_passkeys" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "teacher_id" uuid NOT NULL,
        "credential_id" character varying(1024) NOT NULL,
        "public_key" bytea NOT NULL,
        "counter" bigint NOT NULL DEFAULT 0,
        "transports" text[] NOT NULL DEFAULT '{}',
        "device_type" character varying(32) NOT NULL,
        "backed_up" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teacher_passkeys" PRIMARY KEY ("id"),
        CONSTRAINT "uq_teacher_passkeys_credential_id" UNIQUE ("credential_id"),
        CONSTRAINT "FK_teacher_passkeys_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_teacher_passkeys_teacher_id" ON "teacher_passkeys" ("teacher_id")`);
    await queryRunner.query(`
      CREATE TABLE "teacher_passkey_challenges" (
        "id" uuid NOT NULL,
        "session_id" character varying(255) NOT NULL,
        "teacher_id" uuid NOT NULL,
        "purpose" character varying(16) NOT NULL,
        "challenge" character varying(255) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_teacher_passkey_challenges" PRIMARY KEY ("id"),
        CONSTRAINT "chk_teacher_passkey_challenges_purpose" CHECK ("purpose" IN ('authentication', 'registration')),
        CONSTRAINT "FK_teacher_passkey_challenges_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_teacher_passkey_challenges_expiry" ON "teacher_passkey_challenges" ("expires_at")`);
    await queryRunner.query(`CREATE INDEX "idx_teacher_passkey_challenges_session" ON "teacher_passkey_challenges" ("session_id", "purpose")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_teacher_passkey_challenges_session"`);
    await queryRunner.query(`DROP INDEX "public"."idx_teacher_passkey_challenges_expiry"`);
    await queryRunner.query(`DROP TABLE "teacher_passkey_challenges"`);
    await queryRunner.query(`DROP INDEX "public"."idx_teacher_passkeys_teacher_id"`);
    await queryRunner.query(`DROP TABLE "teacher_passkeys"`);
  }
}
