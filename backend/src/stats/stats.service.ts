import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MAX_TOTAL } from '../common/constants/assessment';
import { ClassSummary, StudentsService } from '../students/students.service';

export interface ActivityItem {
  studentId: number;
  studentName: string;
  classLevel: number;
  section: string;
  status: 'draft' | 'submitted';
  totalMarks: number;
  action: 'created' | 'updated';
  teacher: string;
  at: string;
}

export interface Overview {
  generatedAt: string;
  maxTotal: number;
  totals: {
    students: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    /** Everyone who is not completed yet (in progress + not started). */
    pending: number;
    completionPercent: number;
    /** Average/highest/lowest are over COMPLETED assessments only (null until one exists). */
    average: number | null;
    highest: number | null;
    lowest: number | null;
  };
  classes: Array<ClassSummary & { completionPercent: number; sections: Array<ClassSummary['sections'][number] & { completionPercent: number }> }>;
  /** Number of completed assessments per 5-mark band (lower bound included). */
  distribution: Array<{ label: string; from: number; to: number; count: number }>;
  recentActivity: ActivityItem[];
}

const BANDS = [
  { label: '0–4.99', from: 0, to: 4.99 },
  { label: '5–9.99', from: 5, to: 9.99 },
  { label: '10–14.99', from: 10, to: 14.99 },
  { label: '15–19.99', from: 15, to: 19.99 },
  { label: '20–24.99', from: 20, to: 24.99 },
  { label: '25–30', from: 25, to: 30 },
];

const pct = (done: number, total: number) => (total ? Math.round((done / total) * 1000) / 10 : 0);

@Injectable()
export class StatsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly students: StudentsService,
  ) {}

  /** Teacher dashboard numbers. Everything is computed directly from PostgreSQL. */
  async overview(): Promise<Overview> {
    const [[t], bandRows, activityRows, structure] = await Promise.all([
      this.dataSource.query(`
        SELECT COUNT(*)                                                    AS students,
               COUNT(*) FILTER (WHERE a.status = 'submitted')              AS completed,
               COUNT(*) FILTER (WHERE a.status = 'draft')                  AS in_progress,
               ROUND(AVG(a.total_marks) FILTER (WHERE a.status = 'submitted'), 2) AS average,
               MAX(a.total_marks)       FILTER (WHERE a.status = 'submitted')     AS highest,
               MIN(a.total_marks)       FILTER (WHERE a.status = 'submitted')     AS lowest
          FROM students s LEFT JOIN assessments a ON a.student_id = s.id`),
      this.dataSource.query(`
        SELECT LEAST(FLOOR(total_marks / 5), 5)::int AS band, COUNT(*) AS n
          FROM assessments WHERE status = 'submitted' GROUP BY 1`),
      this.dataSource.query(`
        SELECT s.student_id, s.name, s.class_level, s.section, a.status, a.total_marks, a.version, a.updated_at, t.full_name AS teacher
          FROM assessments a
          JOIN students s ON s.id = a.student_id
          JOIN teachers t ON t.id = a.updated_by
         ORDER BY a.updated_at DESC LIMIT 8`),
      this.students.structure(),
    ]);

    const students = Number(t.students);
    const completed = Number(t.completed);
    const inProgress = Number(t.in_progress);
    const counts = new Map<number, number>(bandRows.map((r: { band: number; n: string }) => [Number(r.band), Number(r.n)]));

    const overview: Overview = {
      generatedAt: new Date().toISOString(),
      maxTotal: MAX_TOTAL,
      totals: {
        students,
        completed,
        inProgress,
        notStarted: students - completed - inProgress,
        pending: students - completed,
        completionPercent: pct(completed, students),
        average: t.average === null ? null : parseFloat(t.average),
        highest: t.highest === null ? null : parseFloat(t.highest),
        lowest: t.lowest === null ? null : parseFloat(t.lowest),
      },
      classes: structure.map((c) => ({
        ...c,
        completionPercent: pct(c.completed, c.students),
        sections: c.sections.map((s) => ({ ...s, completionPercent: pct(s.completed, s.students) })),
      })),
      distribution: BANDS.map((b, i) => ({ ...b, count: counts.get(i) ?? 0 })),
      recentActivity: activityRows.map(
        (r: Record<string, string | number>): ActivityItem => ({
          studentId: Number(r.student_id),
          studentName: String(r.name),
          classLevel: Number(r.class_level),
          section: String(r.section),
          status: r.status as 'draft' | 'submitted',
          totalMarks: parseFloat(String(r.total_marks)),
          action: Number(r.version) === 1 ? 'created' : 'updated',
          teacher: String(r.teacher),
          at: new Date(r.updated_at).toISOString(),
        }),
      ),
    };
    return overview;
  }

  /** The signed-in teacher's own data-entry footprint (profile page). */
  async teacherActivity(teacherId: string) {
    const [row] = await this.dataSource.query(
      `SELECT COUNT(*) FILTER (WHERE created_by = $1) AS created,
              COUNT(*) FILTER (WHERE updated_by = $1) AS last_edited,
              MAX(updated_at) FILTER (WHERE updated_by = $1) AS last_at
         FROM assessments`,
      [teacherId],
    );
    const recent = await this.dataSource.query(
      `SELECT s.student_id, s.name, s.class_level, s.section, a.status, a.total_marks, a.updated_at
         FROM assessments a JOIN students s ON s.id = a.student_id
        WHERE a.updated_by = $1 ORDER BY a.updated_at DESC LIMIT 5`,
      [teacherId],
    );
    return {
      assessmentsCreated: Number(row.created),
      assessmentsLastEditedByMe: Number(row.last_edited),
      lastActivityAt: row.last_at ? new Date(row.last_at).toISOString() : null,
      recent: recent.map((r: Record<string, string | number>) => ({
        studentId: Number(r.student_id),
        studentName: String(r.name),
        classLevel: Number(r.class_level),
        section: String(r.section),
        status: r.status,
        totalMarks: parseFloat(String(r.total_marks)),
        at: new Date(r.updated_at).toISOString(),
      })),
    };
  }
}
