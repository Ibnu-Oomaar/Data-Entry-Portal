import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StudentImportService } from '../src/students/import/student-import.service';
import { TeachersService } from '../src/teachers/teachers.service';
import { FULL_MARKS, Session, WORKBOOK, bootApp, saveMarks, studentSession, teacherSession } from './helpers';

const ci = (x: string, y: string) => (x.toLowerCase() < y.toLowerCase() ? -1 : x.toLowerCase() > y.toLowerCase() ? 1 : 0);

describe('Classes Data Entry Portal (end to end, real PostgreSQL + workbook)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let amina: Session;
  let omar: Session;
  let ids: { a: number; b: number; c: number; other: number };

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, ds } = await bootApp());
    const importer = app.get(StudentImportService);
    const report = await importer.importFromWorkbook(WORKBOOK);
    expect(report.success).toBe(true);

    const teachers = app.get(TeachersService);
    await teachers.provision('Amina Yusuf');
    await teachers.provision('Omar Farah');
    await teachers.provision('Hassan Retired');
    await teachers.setActive('Hassan Retired', false);

    const rows: Array<{ student_id: number }> = await ds.query(
      `SELECT student_id FROM students WHERE class_level = 1 AND section = 'A' ORDER BY name LIMIT 3`,
    );
    const [other] = await ds.query(`SELECT student_id FROM students WHERE class_level = 3 AND section = 'E' ORDER BY name LIMIT 1`);
    ids = { a: rows[0].student_id, b: rows[1].student_id, c: rows[2].student_id, other: other.student_id };
    amina = await teacherSession(app, 'Amina Yusuf');
    omar = await teacherSession(app, 'omar   FARAH');
  });

  afterAll(async () => {
    await app.close();
  });

  // ------------------------------------------------------------------ import
  describe('Excel import (real workbook)', () => {
    it('imported exactly 563 students with the original IDs, classes and sections', async () => {
      const [{ total, unique }] = await ds.query(`SELECT COUNT(*)::int AS total, COUNT(DISTINCT student_id)::int AS "unique" FROM students`);
      expect({ total, unique }).toEqual({ total: 563, unique: 563 });
      const byClass = await ds.query(`SELECT class_level, COUNT(*)::int n FROM students GROUP BY 1 ORDER BY 1`);
      expect(byClass).toEqual([
        { class_level: 1, n: 317 },
        { class_level: 3, n: 246 },
      ]);
      const bySection = await ds.query(`SELECT class_level, section, COUNT(*)::int n FROM students GROUP BY 1,2 ORDER BY 1,2`);
      expect(bySection.map((r: { class_level: number; section: string; n: number }) => `${r.class_level}${r.section}:${r.n}`)).toEqual([
        '1A:56', '1B:53', '1C:56', '1D:51', '1E:51', '1F:50', '3A:51', '3B:50', '3C:49', '3D:49', '3E:47',
      ]);
    });

    it('preserves a known student exactly as in the workbook', async () => {
      const [s] = await ds.query(`SELECT name, class_level, section FROM students WHERE student_id = 11516`);
      expect(s).toEqual({ name: 'Abdalle Daahir Abdi Warsame', class_level: 1, section: 'A' });
    });

    it('re-importing is safe: nothing duplicated, nothing changed', async () => {
      const report = await app.get(StudentImportService).importFromWorkbook(WORKBOOK);
      expect(report.totals).toMatchObject({ inserted: 0, unchanged: 563, conflicts: 0, invalid: 0 });
      const [{ n }] = await ds.query(`SELECT COUNT(*)::int n FROM students`);
      expect(n).toBe(563);
    });

    it('never overwrites a student whose data differs — it reports a conflict instead', async () => {
      await ds.query(`UPDATE students SET name = 'Renamed In Database' WHERE student_id = 11508`);
      const report = await app.get(StudentImportService).importFromWorkbook(WORKBOOK);
      expect(report.success).toBe(false);
      expect(report.totals).toMatchObject({ inserted: 0, unchanged: 562, conflicts: 1 });
      expect(report.conflicts[0]).toMatchObject({ studentId: 11508, fields: ['name'] });
      const [s] = await ds.query(`SELECT name FROM students WHERE student_id = 11508`);
      expect(s.name).toBe('Renamed In Database');
      await ds.query(`UPDATE students SET name = 'Abdalle Mohamed Ismail Abdillahi' WHERE student_id = 11508`);
    });

    it('a dry run writes nothing', async () => {
      await ds.query(`DELETE FROM students WHERE student_id = 11635`);
      const report = await app.get(StudentImportService).importFromWorkbook(WORKBOOK, { dryRun: true });
      expect(report.totals).toMatchObject({ newStudents: 1, inserted: 0 });
      const [{ n }] = await ds.query(`SELECT COUNT(*)::int n FROM students`);
      expect(n).toBe(562);
      await app.get(StudentImportService).importFromWorkbook(WORKBOOK); // restore
      const [{ n: after }] = await ds.query(`SELECT COUNT(*)::int n FROM students`);
      expect(after).toBe(563);
    });

    it('the database itself rejects a duplicate Student ID', async () => {
      await expect(
        ds.query(`INSERT INTO students (student_id, name, class_level, section) VALUES (11516, 'Dup', 1, 'A')`),
      ).rejects.toMatchObject({ code: '23505' });
    });
  });

  // -------------------------------------------------------------------- auth
  describe('Authentication', () => {
    it('rejects unauthenticated access with the standard error envelope', async () => {
      const res = await http().get('/api/students').expect(401);
      expect(res.body).toEqual({ success: false, error: { code: 'UNAUTHENTICATED', message: expect.any(String), statusCode: 401 } });
    });

    it('teacher logs in by name only (case and spacing do not matter) and gets an HttpOnly, SameSite cookie', async () => {
      const res = await http().post('/api/auth/teacher/login').send({ name: '  amina   YUSUF ' }).expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ role: 'teacher', user: { fullName: 'Amina Yusuf' }, school: { name: 'Noradin Boys Secondary School' } });
      expect(res.body.data.csrfToken).toHaveLength(64);
      const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('classes.sid='))!;
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\//);
    });

    it('rejects unknown and deactivated teachers with the same generic error', async () => {
      for (const name of ['Nobody Here', 'Hassan Retired']) {
        const res = await http().post('/api/auth/teacher/login').send({ name }).expect(401);
        expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('validates teacher login input', async () => {
      for (const body of [{}, { name: '' }, { name: '   ' }, { name: 123 }, { name: 'x'.repeat(151) }, { name: 'A B', extra: 1 }]) {
        const res = await http().post('/api/auth/teacher/login').send(body).expect(422);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('prevents ambiguous duplicate teacher names at provisioning time', async () => {
      await expect(app.get(TeachersService).provision('  AMINA yusuf ')).rejects.toMatchObject({ code: 'TEACHER_EXISTS' });
    });

    it('student logs in with the Student ID only (number or numeric string)', async () => {
      for (const studentId of [11516, '11516']) {
        const res = await http().post('/api/auth/student/login').send({ studentId }).expect(200);
        expect(res.body.data).toMatchObject({
          role: 'student',
          user: { studentId: 11516, name: 'Abdalle Daahir Abdi Warsame', classLevel: 1, section: 'A' },
        });
      }
    });

    it('rejects unknown / malformed Student IDs', async () => {
      expect((await http().post('/api/auth/student/login').send({ studentId: 99999999 }).expect(401)).body.error.code).toBe('INVALID_CREDENTIALS');
      for (const studentId of ['abc', 1.5, -3, 0, null, [], '11516; DROP TABLE students']) {
        await http().post('/api/auth/student/login').send({ studentId }).expect(422);
      }
    });

    it('stores sessions in PostgreSQL, and logout destroys the server-side session', async () => {
      const [{ count: before }] = await ds.query(`SELECT COUNT(*)::int AS count FROM app_sessions`);
      const s = await studentSession(app, 11516);
      const [{ count: afterLogin }] = await ds.query(`SELECT COUNT(*)::int AS count FROM app_sessions`);
      expect(afterLogin).toBe(before + 1);
      await s.agent.get('/api/auth/me').expect(200);
      await s.agent.post('/api/auth/logout').set('X-CSRF-Token', s.csrf).expect(200);
      const [{ count: afterLogout }] = await ds.query(`SELECT COUNT(*)::int AS count FROM app_sessions`);
      expect(afterLogout).toBe(before);
      await s.agent.get('/api/auth/me').expect(401);
    });

    it('a new login issues a new session id (no session fixation)', async () => {
      const agent = request.agent(app.getHttpServer());
      const first = await agent.post('/api/auth/student/login').send({ studentId: 11516 }).expect(200);
      const c1 = (first.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
      const second = await agent.post('/api/auth/student/login').send({ studentId: 11516 }).expect(200);
      const c2 = (second.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
      expect(c1).not.toBe(c2);
    });

    it('a deactivated teacher loses access on the very next request', async () => {
      await app.get(TeachersService).provision('Temp Teacher');
      const s = await teacherSession(app, 'Temp Teacher');
      await s.agent.get('/api/students').expect(200);
      await app.get(TeachersService).setActive('Temp Teacher', false);
      const res = await s.agent.get('/api/students').expect(401);
      expect(res.body.error.code).toBe('SESSION_INVALID');
    });

    it('does not send HSTS or upgrade-insecure-requests on a plain-HTTP deployment (COOKIE_SECURE=false)', async () => {
      const res = await http().get('/api/health').expect(200);
      expect(res.headers['strict-transport-security']).toBeUndefined();
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('the /health and /school endpoints are public and contain no personal data', async () => {
      expect((await http().get('/api/health').expect(200)).body.data).toEqual({ status: 'ok' });
      expect((await http().get('/api/school').expect(200)).body.data).toEqual({ name: 'Noradin Boys Secondary School', shift: 'Morning' });
    });

    it('unknown routes and malformed JSON use the same error envelope', async () => {
      expect((await http().get('/api/nope').expect(404)).body.error.code).toBe('NOT_FOUND');
      const bad = await http().post('/api/auth/teacher/login').set('Content-Type', 'application/json').send('{"name": ').expect(400);
      expect(bad.body).toMatchObject({ success: false, error: { statusCode: 400 } });
    });
  });

  // -------------------------------------------------------------------- CSRF
  describe('CSRF protection', () => {
    it('rejects state-changing requests without the session token', async () => {
      const res = await amina.agent.put(`/api/assessments/student/${ids.a}`).send(FULL_MARKS).expect(403);
      expect(res.body.error.code).toBe('CSRF_TOKEN');
      await amina.agent.put(`/api/assessments/student/${ids.a}`).set('X-CSRF-Token', 'f'.repeat(64)).send(FULL_MARKS).expect(403);
    });

    it('rejects a foreign Origin, even on login, and accepts the configured front-end origin', async () => {
      const evil = await http().post('/api/auth/teacher/login').set('Origin', 'http://evil.example').send({ name: 'Amina Yusuf' }).expect(403);
      expect(evil.body.error.code).toBe('CSRF_ORIGIN');
      await amina.agent
        .put(`/api/assessments/student/${ids.other}`)
        .set('Origin', 'http://evil.example')
        .set('X-CSRF-Token', amina.csrf)
        .send(FULL_MARKS)
        .expect(403);
      await http().post('/api/auth/student/login').set('Origin', 'http://localhost:5173').send({ studentId: 11516 }).expect(200);
    });

    it('/auth/me re-delivers the token to a reloaded page', async () => {
      const res = await amina.agent.get('/api/auth/me').expect(200);
      expect(res.body.data.csrfToken).toBe(amina.csrf);
    });
  });

  // ------------------------------------------------------------ authorization
  describe('Authorization (server-side)', () => {
    it('students cannot reach any teacher functionality', async () => {
      const s = await studentSession(app, 11516);
      for (const path of ['/api/students', '/api/students/structure', '/api/stats/overview', '/api/stats/me', '/api/assessments', `/api/assessments/student/${ids.a}`]) {
        const res = await s.agent.get(path).expect(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
      await saveMarks(s, ids.a, FULL_MARKS).expect(403);
    });

    it('teachers cannot use the student-only endpoint', async () => {
      await amina.agent.get('/api/me/assessment').expect(403);
    });

    it('there is no route for students to edit or delete assessments', async () => {
      const s = await studentSession(app, 11516);
      await s.agent.delete(`/api/assessments/student/${ids.a}`).set('X-CSRF-Token', s.csrf).expect(404);
      await s.agent.post('/api/me/assessment').set('X-CSRF-Token', s.csrf).send(FULL_MARKS).expect(404);
      await s.agent.put('/api/me/assessment').set('X-CSRF-Token', s.csrf).send(FULL_MARKS).expect(404);
    });
  });

  // ---------------------------------------------------------- student listing
  describe('Students: classification, filtering and sorting', () => {
    const list = (qs: string) => amina.agent.get(`/api/students?${qs}`).expect(200);

    it('class → section structure matches the workbook', async () => {
      const { data } = (await amina.agent.get('/api/students/structure').expect(200)).body;
      expect(data.map((c: { classLevel: number; students: number; sections: unknown[] }) => [c.classLevel, c.students, c.sections.length])).toEqual([
        [1, 317, 6],
        [3, 246, 5],
      ]);
      expect(data[0].sections.map((s: { section: string; students: number }) => `${s.section}${s.students}`)).toEqual(['A56', 'B53', 'C56', 'D51', 'E51', 'F50']);
      expect(data[1].sections.map((s: { section: string; students: number }) => `${s.section}${s.students}`)).toEqual(['A51', 'B50', 'C49', 'D49', 'E47']);
    });

    it('filters by class and by section', async () => {
      expect((await list('classLevel=1&pageSize=1')).body.meta.total).toBe(317);
      expect((await list('classLevel=3&pageSize=1')).body.meta.total).toBe(246);
      expect((await list('section=F&pageSize=1')).body.meta.total).toBe(50);
      expect((await list('section=a&pageSize=1')).body.meta.total).toBe(107); // case-insensitive input
      const a = await list('classLevel=1&section=A&pageSize=200');
      expect(a.body.meta).toMatchObject({ total: 56, totalPages: 1 });
      expect(a.body.data).toHaveLength(56);
      expect(a.body.data.every((s: { classLevel: number; section: string }) => s.classLevel === 1 && s.section === 'A')).toBe(true);
      expect((await list('classLevel=3&section=F')).body.meta.total).toBe(0); // Class 3 has no section F
    });

    it('default order is by class, section, then name', async () => {
      const first = (await list('pageSize=1')).body.data[0];
      expect([first.classLevel, first.section]).toEqual([1, 'A']);
      const last = (await list('page=23&pageSize=25')).body.data.at(-1);
      expect([last.classLevel, last.section]).toEqual([3, 'E']);
      const sec = (await list('classLevel=1&section=B&pageSize=200')).body.data.map((s: { name: string }) => s.name);
      expect(sec).toEqual([...sec].sort(ci));
    });

    it('sorts by any column in either direction (Student ID sorts numerically)', async () => {
      const [{ min, max }] = await ds.query(`SELECT MIN(student_id) min, MAX(student_id) max FROM students`);
      expect((await list('sortBy=studentId&sortDir=asc&pageSize=1')).body.data[0].studentId).toBe(min);
      expect((await list('sortBy=studentId&sortDir=desc&pageSize=1')).body.data[0].studentId).toBe(max);
      const byName = (await list('sortBy=name&sortDir=desc&pageSize=200')).body.data.map((s: { name: string }) => s.name);
      expect(byName).toEqual([...byName].sort((x, y) => ci(y, x)));
      const byNameAsc = (await list('sortBy=name&sortDir=asc&pageSize=200')).body.data.map((s: { name: string }) => s.name);
      expect(byNameAsc).toEqual([...byNameAsc].sort(ci));
      expect(byNameAsc[0]).not.toBe(byName[0]); // direction really changes the result
      const bySection = (await list('sortBy=section&sortDir=desc&pageSize=1')).body.data[0];
      expect(bySection.section).toBe('F');
      const bySectionAsc = (await list('sortBy=section&sortDir=asc&pageSize=1')).body.data[0];
      expect(bySectionAsc.section).toBe('A');
      const byClassDesc = (await list('sortBy=classLevel&sortDir=desc&pageSize=1')).body.data[0];
      expect(byClassDesc.classLevel).toBe(3);
      const byClassAsc = (await list('sortBy=classLevel&sortDir=asc&pageSize=1')).body.data[0];
      expect(byClassAsc.classLevel).toBe(1);
      // within a class filter, sections sort in the requested direction
      const secDesc = (await list('classLevel=3&sortBy=section&sortDir=desc&pageSize=200')).body.data.map((s: { section: string }) => s.section);
      expect(secDesc[0]).toBe('E');
      expect(secDesc).toEqual([...secDesc].sort().reverse());
      const classSecDesc = (await list('sortBy=classSection&sortDir=desc&pageSize=1')).body.data[0];
      expect([classSecDesc.classLevel, classSecDesc.section]).toEqual([3, 'E']);
    });

    it('searches by name fragment or Student ID, and treats % and _ literally', async () => {
      const byName = await list('search=abdalle&pageSize=200');
      expect(byName.body.data.length).toBeGreaterThan(1);
      expect(byName.body.data.every((s: { name: string }) => /abdalle/i.test(s.name))).toBe(true);
      expect((await list('search=11516')).body.data.map((s: { studentId: number }) => s.studentId)).toContain(11516);
      expect((await list('search=%25')).body.meta.total).toBe(0);
      expect((await list('search=_')).body.meta.total).toBe(0);
      expect((await list('search=zzzzqqq')).body.data).toEqual([]);
    });

    it('rejects invalid query parameters (whitelisted sort fields, bounded paging)', async () => {
      for (const qs of ['sortBy=password', 'sortDir=sideways', 'pageSize=1000', 'page=0', 'classLevel=abc', 'section=AB', 'status=done', 'sortBy=name;DROP']) {
        const res = await amina.agent.get(`/api/students?${qs}`).expect(422);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('paginates with accurate metadata', async () => {
      const p = await list('pageSize=100&page=6');
      expect(p.body.meta).toEqual({ page: 6, pageSize: 100, total: 563, totalPages: 6 });
      expect(p.body.data).toHaveLength(63);
    });
  });

  // ------------------------------------------------- statistics on an empty system
  describe('Statistics before any marks exist', () => {
    it('shows null / zero — never made-up numbers', async () => {
      const [{ n }] = await ds.query(`SELECT COUNT(*)::int n FROM assessments`);
      expect(n).toBe(0);
      const res = await amina.agent.get('/api/stats/overview').expect(200);
      expect(res.body.data.totals).toEqual({
        students: 563, completed: 0, inProgress: 0, notStarted: 563, pending: 563,
        completionPercent: 0, average: null, highest: null, lowest: null,
      });
      expect(res.body.data.recentActivity).toEqual([]);
      expect(res.body.data.distribution.every((b: { count: number }) => b.count === 0)).toBe(true);
      expect((await amina.agent.get('/api/assessments').expect(200)).body).toMatchObject({ data: [], meta: { total: 0 } });
      const mine = (await amina.agent.get('/api/stats/me').expect(200)).body.data;
      expect(mine).toMatchObject({ assessmentsCreated: 0, lastActivityAt: null, recent: [] });
    });
  });

  // ------------------------------------------------------------- marks entry
  describe('Marks entry', () => {
    it('shows "nothing entered yet" for a student with no record', async () => {
      const res = await amina.agent.get(`/api/assessments/student/${ids.a}`).expect(200);
      expect(res.body.data.assessment).toBeNull();
      expect(res.body.data.student).toMatchObject({ studentId: ids.a, classLevel: 1, section: 'A' });
    });

    it('creates an assessment: total, subtotals, remaining and status are calculated by the server', async () => {
      const res = await saveMarks(amina, ids.a, {
        chapter1Notes: 1, chapter1Exercises: 4, chapter1Assignment: 3,
        chapter2Notes: 2, chapter2Exercises: 5, chapter2Assignment: 4,
        textbook: 3,
      }).expect(200);
      expect(res.body.data).toMatchObject({ created: true, unchanged: false });
      expect(res.body.data.assessment).toMatchObject({
        subtotals: { chapter1: 8, chapter2: 11, textbook: 3 },
        totalMarks: 22,
        maxTotal: 30,
        remaining: 8,
        status: 'submitted',
        enteredCount: 7,
        version: 1,
        createdBy: 'Amina Yusuf',
        updatedBy: 'Amina Yusuf',
      });
    });

    it('rejects a client-supplied total (totals are never trusted from the browser)', async () => {
      const res = await saveMarks(amina, ids.b, { ...FULL_MARKS, totalMarks: 30 }).expect(422);
      expect(res.body.error.details[0]).toMatchObject({ field: 'totalMarks' });
    });

    it.each([
      ['chapter1Notes', 3, 'Chapter 1 Notes cannot be more than 2'],
      ['chapter1Exercises', 7, 'Chapter 1 Exercises cannot be more than 6'],
      ['chapter1Assignment', 6, 'Chapter 1 Assignment cannot be more than 5'],
      ['chapter2Notes', 2.5, 'Chapter 2 Notes cannot be more than 2'],
      ['chapter2Exercises', 6.01, 'Chapter 2 Exercises cannot be more than 6'],
      ['chapter2Assignment', 50, 'Chapter 2 Assignment cannot be more than 5'],
      ['textbook', 5, 'Textbook cannot be more than 4'],
      ['textbook', -1, 'Textbook cannot be negative'],
    ])('backend rejects %s = %p with a clear field message', async (field, value, message) => {
      const res = await saveMarks(amina, ids.b, { ...FULL_MARKS, [field]: value }).expect(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(expect.arrayContaining([{ field, message }]));
    });

    it('rejects non-numeric, over-precise, missing and unknown inputs', async () => {
      await saveMarks(amina, ids.b, { ...FULL_MARKS, textbook: '4' }).expect(422);
      await saveMarks(amina, ids.b, { ...FULL_MARKS, textbook: 'abc' }).expect(422);
      await saveMarks(amina, ids.b, { ...FULL_MARKS, chapter1Notes: 1.234 }).expect(422);
      const { textbook, ...missing } = FULL_MARKS;
      void textbook;
      await saveMarks(amina, ids.b, missing).expect(422);
      await saveMarks(amina, ids.b, { ...FULL_MARKS, isAdmin: true }).expect(422);
      await saveMarks(amina, 99999999, FULL_MARKS).expect(404);
      await saveMarks(amina, 'abc' as unknown as number, FULL_MARKS).expect(422);
    });

    it('requires at least one mark', async () => {
      const empty = Object.fromEntries(Object.keys(FULL_MARKS).map((k) => [k, null]));
      const res = await saveMarks(amina, ids.b, empty).expect(422);
      expect(res.body.error.code).toBe('NO_MARKS');
    });

    it('accepts the exact maximum (30/30) and keeps 0 distinct from "not entered"', async () => {
      const res = await saveMarks(amina, ids.b, FULL_MARKS).expect(200);
      expect(res.body.data.assessment).toMatchObject({ totalMarks: 30, remaining: 0, status: 'submitted' });
      const zero = await saveMarks(amina, ids.other, Object.fromEntries(Object.keys(FULL_MARKS).map((k) => [k, 0]))).expect(200);
      expect(zero.body.data.assessment).toMatchObject({ totalMarks: 0, remaining: 30, status: 'submitted' });
    });

    it('saves partial entry as an "in progress" draft (remaining marks shown)', async () => {
      const res = await saveMarks(amina, ids.c, {
        chapter1Notes: 2, chapter1Exercises: 5, chapter1Assignment: 4,
        chapter2Notes: null, chapter2Exercises: null, chapter2Assignment: null, textbook: null,
      }).expect(200);
      expect(res.body.data.assessment).toMatchObject({ status: 'draft', totalMarks: 11, remaining: 19, enteredCount: 3 });
      expect(res.body.data.assessment.marks.textbook).toBeNull();
    });

    it('fractional marks are exact', async () => {
      await ds.query(`DELETE FROM assessments WHERE student_id = (SELECT id FROM students WHERE student_id = $1)`, [ids.other]);
      const res = await saveMarks(amina, ids.other, {
        chapter1Notes: 0.1, chapter1Exercises: 0.2, chapter1Assignment: null,
        chapter2Notes: null, chapter2Exercises: null, chapter2Assignment: null, textbook: 1.15,
      }).expect(200);
      expect(res.body.data.assessment.totalMarks).toBe(1.45);
      const [row] = await ds.query(`SELECT total_marks::text t FROM assessments a JOIN students s ON s.id=a.student_id WHERE s.student_id=$1`, [ids.other]);
      expect(row.t).toBe('1.45');
    });

    it('the database enforces the marks rules even if the API is bypassed', async () => {
      await expect(ds.query(`UPDATE assessments SET chapter1_notes = 5 WHERE student_id = (SELECT id FROM students WHERE student_id = $1)`, [ids.a])).rejects.toMatchObject({ code: '23514' });
      await expect(ds.query(`UPDATE assessments SET chapter1_notes = -1 WHERE student_id = (SELECT id FROM students WHERE student_id = $1)`, [ids.a])).rejects.toMatchObject({ code: '23514' });
      await expect(ds.query(`UPDATE assessments SET total_marks = 29 WHERE student_id = (SELECT id FROM students WHERE student_id = $1)`, [ids.a])).rejects.toMatchObject({ code: '23514' });
      await expect(ds.query(`UPDATE assessments SET status = 'draft' WHERE student_id = (SELECT id FROM students WHERE student_id = $1)`, [ids.a])).rejects.toMatchObject({ code: '23514' });
    });

    it('only one assessment row can exist per student', async () => {
      await expect(
        ds.query(
          `INSERT INTO assessments (student_id, chapter1_notes, total_marks, status, created_by, updated_by)
           SELECT a.student_id, 1, 1, 'draft', a.created_by, a.updated_by FROM assessments a JOIN students s ON s.id=a.student_id WHERE s.student_id=$1`,
          [ids.a],
        ),
      ).rejects.toMatchObject({ code: '23505' });
    });
  });

  // ------------------------------------------------------ updates & integrity
  describe('Updates, concurrency and audit trail', () => {
    it('updates with the current version, bumps it, and records WHO changed it (creator unchanged)', async () => {
      const res = await saveMarks(omar, ids.a, {
        chapter1Notes: 2, chapter1Exercises: 6, chapter1Assignment: 5,
        chapter2Notes: 2, chapter2Exercises: 5, chapter2Assignment: 4, textbook: 3,
        expectedVersion: 1,
      }).expect(200);
      expect(res.body.data).toMatchObject({ created: false, unchanged: false });
      expect(res.body.data.assessment).toMatchObject({ totalMarks: 27, version: 2, createdBy: 'Amina Yusuf', updatedBy: 'Omar Farah' });
    });

    it('refuses to overwrite newer data with a stale form (HTTP 409)', async () => {
      const res = await saveMarks(amina, ids.a, { ...FULL_MARKS, chapter1Notes: 1, expectedVersion: 1 }).expect(409);
      expect(res.body.error.code).toBe('STALE_ASSESSMENT');
      const now = await amina.agent.get(`/api/assessments/student/${ids.a}`).expect(200);
      expect(now.body.data.assessment).toMatchObject({ totalMarks: 27, version: 2, updatedBy: 'Omar Farah' });
    });

    it('does not let a blind "create" overwrite an existing record', async () => {
      await saveMarks(amina, ids.a, { ...FULL_MARKS, chapter1Notes: 1 }).expect(409);
    });

    it('re-submitting identical marks (double click / retry) is a harmless no-op', async () => {
      const before = (await amina.agent.get(`/api/assessments/student/${ids.a}`)).body.data.assessment;
      const res = await saveMarks(amina, ids.a, { ...before.marks, expectedVersion: 1 }).expect(200);
      expect(res.body.data).toMatchObject({ created: false, unchanged: true });
      expect(res.body.data.assessment.version).toBe(before.version);
      expect(res.body.data.assessment.updatedAt).toBe(before.updatedAt);
    });

    it('two simultaneous first saves for one student create exactly one record', async () => {
      const [{ student_id }] = await ds.query(`SELECT student_id FROM students WHERE class_level = 3 AND section = 'A' ORDER BY name LIMIT 1`);
      const one = { chapter1Notes: 1, chapter1Exercises: 1, chapter1Assignment: 1, chapter2Notes: 1, chapter2Exercises: 1, chapter2Assignment: 1, textbook: 1 };
      const two = { ...one, textbook: 2 };
      const results = await Promise.all([saveMarks(amina, student_id, one), saveMarks(omar, student_id, two)]);
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([200, 409]);
      const [{ n }] = await ds.query(`SELECT COUNT(*)::int n FROM assessments a JOIN students s ON s.id=a.student_id WHERE s.student_id=$1`, [student_id]);
      expect(n).toBe(1);
      // identical simultaneous submits both end well (the loser becomes a no-op)
      const [{ student_id: other }] = await ds.query(`SELECT student_id FROM students WHERE class_level = 3 AND section = 'B' ORDER BY name LIMIT 1`);
      const same = await Promise.all([saveMarks(amina, other, one), saveMarks(amina, other, one)]);
      expect(same.map((r) => r.status)).toEqual([200, 200]);
      const [{ n: n2 }] = await ds.query(`SELECT COUNT(*)::int n FROM assessments a JOIN students s ON s.id=a.student_id WHERE s.student_id=$1`, [other]);
      expect(n2).toBe(1);
    });

    it('completing a draft flips it to submitted', async () => {
      const draft = (await amina.agent.get(`/api/assessments/student/${ids.c}`)).body.data.assessment;
      expect(draft.status).toBe('draft');
      const res = await saveMarks(amina, ids.c, { ...draft.marks, chapter2Notes: 2, chapter2Exercises: 6, chapter2Assignment: 5, textbook: 4, expectedVersion: draft.version }).expect(200);
      expect(res.body.data.assessment).toMatchObject({ status: 'submitted', totalMarks: 11 + 17, version: draft.version + 1 });
    });
  });

  // ----------------------------------------------------------- student portal
  describe('Student dashboard data', () => {
    it("a student sees only their own record, with every component and subtotal — no teacher names", async () => {
      const s = await studentSession(app, ids.a);
      const res = await s.agent.get('/api/me/assessment').expect(200);
      expect(res.body.data.student.studentId).toBe(ids.a);
      expect(res.body.data.assessment).toMatchObject({
        marks: { chapter1Notes: 2, chapter1Exercises: 6, chapter1Assignment: 5, chapter2Notes: 2, chapter2Exercises: 5, chapter2Assignment: 4, textbook: 3 },
        subtotals: { chapter1: 13, chapter2: 11, textbook: 3 },
        totalMarks: 27,
        maxTotal: 30,
        status: 'submitted',
      });
      expect(res.body.data.assessment).not.toHaveProperty('createdBy');
      expect(res.body.data.assessment).not.toHaveProperty('updatedBy');
    });

    it('a student cannot see another student by any parameter', async () => {
      const s = await studentSession(app, ids.a);
      const res = await s.agent.get(`/api/me/assessment?studentId=${ids.b}&id=${ids.b}`).expect(200);
      expect(res.body.data.student.studentId).toBe(ids.a);
      const other = await studentSession(app, ids.b);
      expect((await other.agent.get('/api/me/assessment')).body.data.assessment.totalMarks).toBe(30);
    });

    it('a student with no marks yet gets an empty (not fake) result', async () => {
      const [{ student_id }] = await ds.query(`SELECT student_id FROM students WHERE class_level = 1 AND section = 'F' LIMIT 1`);
      const s = await studentSession(app, student_id);
      const res = await s.agent.get('/api/me/assessment').expect(200);
      expect(res.body.data.assessment).toBeNull();
    });
  });

  // ------------------------------------------------------ lists and statistics
  describe('Assessment records and statistics', () => {
    it('status filter on the student list: pending / draft / submitted', async () => {
      const get = (st: string) => amina.agent.get(`/api/students?status=${st}&pageSize=1`).then((r) => r.body.meta.total);
      const submitted = (await ds.query(`SELECT COUNT(*)::int n FROM assessments WHERE status='submitted'`))[0].n;
      const draft = (await ds.query(`SELECT COUNT(*)::int n FROM assessments WHERE status='draft'`))[0].n;
      expect(await get('submitted')).toBe(submitted);
      expect(await get('draft')).toBe(draft);
      expect(await get('pending')).toBe(563 - submitted - draft);
    });

    it('student rows carry the real total and status for the entry list', async () => {
      const res = await amina.agent.get(`/api/students?search=${ids.a}`).expect(200);
      const row = res.body.data.find((s: { studentId: number }) => s.studentId === ids.a);
      expect(row).toMatchObject({ status: 'submitted', totalMarks: 27, version: 2 });
      const none = (await amina.agent.get('/api/students?classLevel=1&section=F&pageSize=1')).body.data[0];
      expect(none).toMatchObject({ status: 'pending', totalMarks: null, version: null });
    });

    it('the assessment records list includes all components and audit info, newest first', async () => {
      const res = await amina.agent.get('/api/assessments?pageSize=50').expect(200);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(4);
      const dates = res.body.data.map((r: { updatedAt: string }) => r.updatedAt);
      expect(dates).toEqual([...dates].sort().reverse());
      const row = res.body.data.find((r: { studentId: number }) => r.studentId === ids.a);
      expect(row).toMatchObject({ totalMarks: 27, status: 'submitted', createdBy: 'Amina Yusuf', updatedBy: 'Omar Farah' });
      expect(Object.keys(row.marks)).toHaveLength(7);
      const drafts = await amina.agent.get('/api/assessments?status=draft').expect(200);
      expect(drafts.body.data.every((r: { status: string }) => r.status === 'draft')).toBe(true);
      expect((await amina.agent.get('/api/assessments?status=pending')).body.meta.total).toBe(0);
      const sorted = await amina.agent.get('/api/assessments?sortBy=totalMarks&sortDir=desc').expect(200);
      const totals = sorted.body.data.map((r: { totalMarks: number }) => r.totalMarks);
      expect(totals).toEqual([...totals].sort((x, y) => y - x));
    });

    it('overview statistics are computed from real records', async () => {
      const res = await amina.agent.get('/api/stats/overview').expect(200);
      const [agg] = await ds.query(
        `SELECT COUNT(*) FILTER (WHERE status='submitted')::int completed, COUNT(*) FILTER (WHERE status='draft')::int draft,
                ROUND(AVG(total_marks) FILTER (WHERE status='submitted'),2)::float avg,
                MAX(total_marks) FILTER (WHERE status='submitted')::float hi, MIN(total_marks) FILTER (WHERE status='submitted')::float lo
           FROM assessments`,
      );
      const t = res.body.data.totals;
      expect(t).toMatchObject({
        students: 563,
        completed: agg.completed,
        inProgress: agg.draft,
        pending: 563 - agg.completed,
        notStarted: 563 - agg.completed - agg.draft,
        average: agg.avg,
        highest: agg.hi,
        lowest: agg.lo,
        completionPercent: Math.round((agg.completed / 563) * 1000) / 10,
      });
      expect(res.body.data.classes.map((c: { classLevel: number; students: number }) => [c.classLevel, c.students])).toEqual([[1, 317], [3, 246]]);
      const secA = res.body.data.classes[0].sections[0];
      expect(secA).toMatchObject({ section: 'A', students: 56 });
      expect(secA.completed).toBeGreaterThanOrEqual(3);
      const dist = res.body.data.distribution as Array<{ count: number }>;
      expect(dist).toHaveLength(6);
      expect(dist.reduce((s, b) => s + b.count, 0)).toBe(agg.completed);
      expect(res.body.data.recentActivity.length).toBeGreaterThan(0);
      expect(res.body.data.recentActivity[0]).toMatchObject({ teacher: expect.any(String), action: expect.stringMatching(/created|updated/) });
    });

    it('overview reflects assessment updates immediately', async () => {
      await amina.agent.get('/api/stats/overview').expect(200);
      const cur = (await amina.agent.get(`/api/assessments/student/${ids.b}`)).body.data.assessment;
      await saveMarks(amina, ids.b, { ...cur.marks, chapter1Notes: 1, expectedVersion: cur.version }).expect(200);
      const fresh = (await amina.agent.get('/api/stats/overview')).body.data;
      expect(fresh.recentActivity[0]).toMatchObject({ studentId: ids.b, totalMarks: 29 });
    });

    it('teacher activity (profile) counts only that teacher', async () => {
      const a = (await amina.agent.get('/api/stats/me').expect(200)).body.data;
      const o = (await omar.agent.get('/api/stats/me').expect(200)).body.data;
      expect(a.assessmentsCreated).toBeGreaterThanOrEqual(3);
      expect(o.assessmentsLastEditedByMe).toBeGreaterThanOrEqual(1); // Omar updated ids.a
      expect(a.assessmentsCreated + o.assessmentsCreated).toBe((await ds.query(`SELECT COUNT(*)::int n FROM assessments`))[0].n);
      expect(a.recent.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------- rate limiting
  describe('Rate limiting (PostgreSQL)', () => {
    it('blocks repeated failed logins from one client with 429 + Retry-After, even for a valid name', async () => {
      await ds.query(`DELETE FROM app_rate_limits`);
      const agent = request.agent(app.getHttpServer());
      for (let i = 0; i < 5; i++) await agent.post('/api/auth/student/login').send({ studentId: 90000000 + i }).expect(401);
      const blocked = await agent.post('/api/auth/teacher/login').send({ name: 'Amina Yusuf' }).expect(429);
      expect(blocked.body.error.code).toBe('RATE_LIMITED');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
      await ds.query(`DELETE FROM app_rate_limits`);
      await agent.post('/api/auth/teacher/login').send({ name: 'Amina Yusuf' }).expect(200);
    });
  });
});
