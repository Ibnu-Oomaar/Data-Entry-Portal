import { MigrationInterface, QueryRunner } from 'typeorm';

export class PostgresOperationalTables1794670000000 implements MigrationInterface {
  name = 'PostgresOperationalTables1794670000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "app_sessions" ("sid" character varying(255) NOT NULL, "sess" jsonb NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_app_sessions_sid" PRIMARY KEY ("sid"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_app_sessions_expires_at" ON "app_sessions" ("expires_at")`);
    await queryRunner.query(
      `CREATE TABLE "app_rate_limits" ("key" text NOT NULL, "count" integer NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_app_rate_limits_key" PRIMARY KEY ("key"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_app_rate_limits_expires_at" ON "app_rate_limits" ("expires_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_app_rate_limits_expires_at"`);
    await queryRunner.query(`DROP TABLE "app_rate_limits"`);
    await queryRunner.query(`DROP INDEX "public"."idx_app_sessions_expires_at"`);
    await queryRunner.query(`DROP TABLE "app_sessions"`);
  }
}
