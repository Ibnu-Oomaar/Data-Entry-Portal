import { MigrationInterface, QueryRunner } from 'typeorm';

type TeacherForeignKey = {
  constraint_name: string;
  table_name: string;
  column_name: string;
};

export class KhalidHarunTeacherOffboarding1794710000000 implements MigrationInterface {
  name = 'KhalidHarunTeacherOffboarding1794710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const teachers: Array<{ id: string; full_name: string }> = await queryRunner.query(
      `SELECT id, full_name FROM teachers WHERE normalized_name = $1 FOR UPDATE`,
      ['khalid harun'],
    );
    const teacherCount: Array<{ count: string }> = await queryRunner.query(`SELECT COUNT(*)::text AS count FROM teachers`);
    const hasTeachers = Number(teacherCount[0].count) > 0;
    if (teachers.length !== 1 && hasTeachers) {
      throw new Error('Cannot offboard teachers unless exactly one Khalid Harun account exists.');
    }

    await queryRunner.query(`ALTER TABLE "assessments" ADD "created_by_name" character varying(150)`);
    await queryRunner.query(`ALTER TABLE "assessments" ADD "updated_by_name" character varying(150)`);
    await queryRunner.query(`
      UPDATE "assessments" a
         SET "created_by_name" = creator.full_name,
             "updated_by_name" = editor.full_name
        FROM "teachers" creator, "teachers" editor
       WHERE creator.id = a.created_by AND editor.id = a.updated_by
    `);

    const missingAuditNames: Array<{ count: string }> = await queryRunner.query(
      `SELECT COUNT(*)::text AS count FROM assessments WHERE created_by_name IS NULL OR updated_by_name IS NULL`,
    );
    if (Number(missingAuditNames[0].count) > 0) {
      throw new Error('Cannot preserve assessment attribution because an audit actor name could not be resolved.');
    }

    const teacherForeignKeys: TeacherForeignKey[] = await queryRunner.query(`
      SELECT c.conname AS constraint_name, src.relname AS table_name, att.attname AS column_name
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_namespace ns ON ns.oid = src.relnamespace
        JOIN pg_class dst ON dst.oid = c.confrelid
        JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS key(attnum, ord) ON true
        JOIN pg_attribute att ON att.attrelid = src.oid AND att.attnum = key.attnum
       WHERE c.contype = 'f' AND dst.relname = 'teachers' AND ns.nspname = 'public'
    `);
    const expectedForeignKeys = new Set([
      'teacher_class_sections.teacher_id',
      'assessments.teacher_id',
      'assessments.created_by',
      'assessments.updated_by',
    ]);
    const unexpectedForeignKeys = teacherForeignKeys.filter((fk) => !expectedForeignKeys.has(`${fk.table_name}.${fk.column_name}`));
    if (unexpectedForeignKeys.length > 0) {
      throw new Error(`Cannot offboard teachers with unhandled references: ${unexpectedForeignKeys.map((fk) => `${fk.table_name}.${fk.column_name}`).join(', ')}`);
    }

    for (const fk of teacherForeignKeys.filter((item) => item.table_name === 'assessments' && ['created_by', 'updated_by'].includes(item.column_name))) {
      const constraint = fk.constraint_name.replace(/"/g, '""');
      await queryRunner.query(`ALTER TABLE "assessments" DROP CONSTRAINT "${constraint}"`);
    }

    await queryRunner.query(`
      CREATE TABLE "assessment_teacher_ownership_archive" AS
      SELECT a.*,
             owner.full_name AS former_owner_name,
             target.id AS requested_owner_id,
             now() AS archived_at,
             'owner collision; preserved without overwrite or merge'::text AS archive_reason
        FROM "assessments" a
        JOIN "teachers" owner ON owner.id = a.teacher_id
        CROSS JOIN "teachers" target
       WHERE false
    `);
    await queryRunner.query(`ALTER TABLE "assessment_teacher_ownership_archive" ADD CONSTRAINT "PK_assessment_teacher_ownership_archive" PRIMARY KEY ("id")`);
    await queryRunner.query(
      `ALTER TABLE "assessment_teacher_ownership_archive" ADD CONSTRAINT "FK_assessment_teacher_archive_student" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "assessment_teacher_ownership_archive" ADD CONSTRAINT "FK_assessment_teacher_archive_target" FOREIGN KEY ("requested_owner_id") REFERENCES "teachers"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(`
      CREATE TABLE "assessment_teacher_ownership_transfers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "assessment_id" uuid NOT NULL,
        "previous_teacher_id" uuid NOT NULL,
        "previous_teacher_name" character varying(150) NOT NULL,
        "new_teacher_id" uuid NOT NULL,
        "transferred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assessment_teacher_ownership_transfers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_assessment_teacher_transfer_assessment" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_assessment_teacher_transfer_target" FOREIGN KEY ("new_teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT
      )
    `);

    if (!hasTeachers) return;

    const khalidId = teachers[0].id;
    const unresolvedCollisions: Array<{ count: string }> = await queryRunner.query(
      `SELECT COUNT(*)::text AS count
         FROM (
           SELECT student_id
             FROM assessments
            GROUP BY student_id
           HAVING COUNT(*) > 1
              AND COUNT(*) FILTER (WHERE teacher_id = $1) <> 1
              AND BOOL_OR(teacher_id <> $1)
         ) collisions`,
      [khalidId],
    );
    if (Number(unresolvedCollisions[0].count) > 0) {
      throw new Error('Cannot transfer assessment ownership: a duplicate student has no single existing Khalid Harun assessment to retain.');
    }

    await queryRunner.query(
      `INSERT INTO "assessment_teacher_ownership_archive"
       SELECT a.*, owner.full_name, $1, now(), 'owner collision; preserved without overwrite or merge'
         FROM "assessments" a
         JOIN "teachers" owner ON owner.id = a.teacher_id
        WHERE a.teacher_id <> $1
          AND EXISTS (
            SELECT 1 FROM "assessments" existing
             WHERE existing.student_id = a.student_id
               AND existing.teacher_id = $1
          )`,
      [khalidId],
    );
    await queryRunner.query(
      `DELETE FROM "assessments" a
        WHERE a.teacher_id <> $1
          AND EXISTS (
            SELECT 1 FROM "assessments" existing
             WHERE existing.student_id = a.student_id
               AND existing.teacher_id = $1
          )`,
      [khalidId],
    );

    await queryRunner.query(
      `INSERT INTO "assessment_teacher_ownership_transfers"
         ("assessment_id", "previous_teacher_id", "previous_teacher_name", "new_teacher_id")
       SELECT a.id, a.teacher_id, previous.full_name, $1
         FROM "assessments" a
         JOIN "teachers" previous ON previous.id = a.teacher_id
        WHERE a.teacher_id <> $1`,
      [khalidId],
    );
    await queryRunner.query(`UPDATE "assessments" SET "teacher_id" = $1 WHERE "teacher_id" <> $1`, [khalidId]);
    await queryRunner.query(`DELETE FROM "teacher_class_sections" WHERE "teacher_id" <> $1`, [khalidId]);

    const remainingReferences: Array<{ assignments: string; assessments: string }> = await queryRunner.query(
      `SELECT
         (SELECT COUNT(*)::text FROM teacher_class_sections WHERE teacher_id <> $1) AS assignments,
         (SELECT COUNT(*)::text FROM assessments WHERE teacher_id <> $1) AS assessments`,
      [khalidId],
    );
    if (Number(remainingReferences[0].assignments) > 0 || Number(remainingReferences[0].assessments) > 0) {
      throw new Error('Cannot delete teacher accounts while class assignments or owned assessments still reference them.');
    }

    await queryRunner.query(`UPDATE "teachers" SET "is_active" = true WHERE "id" = $1`, [khalidId]);
    await queryRunner.query(`DELETE FROM "teachers" WHERE "id" <> $1`, [khalidId]);

    const remainingTeachers: Array<{ count: string; full_name: string; is_active: boolean }> = await queryRunner.query(
      `SELECT COUNT(*)::text AS count, MIN(full_name) AS full_name, BOOL_AND(is_active) AS is_active FROM teachers`,
    );
    if (
      Number(remainingTeachers[0].count) !== 1 ||
      remainingTeachers[0].full_name !== 'Khalid Harun' ||
      !remainingTeachers[0].is_active
    ) {
      throw new Error('Teacher offboarding did not leave exactly one active Khalid Harun account.');
    }
  }

  public async down(): Promise<void> {
    throw new Error('Teacher offboarding is irreversible: restore teacher and assessment data from a verified backup.');
  }
}
