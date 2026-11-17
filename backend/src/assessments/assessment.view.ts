import { MAX_TOTAL, MarksInput, COMPONENT_KEYS } from '../common/constants/assessment';
import { computeAssessment } from '../common/utils/marks';
import { Student } from '../students/student.entity';
import { Assessment } from './assessment.entity';

export interface StudentSummary {
  studentId: number;
  name: string;
  classLevel: number;
  section: string;
}

export interface AssessmentView {
  marks: MarksInput;
  subtotals: { chapter1: number; chapter2: number; textbook: number };
  totalMarks: number;
  maxTotal: number;
  remaining: number;
  enteredCount: number;
  status: 'draft' | 'submitted';
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Audit fields are only included in teacher responses. */
  createdBy?: string;
  updatedBy?: string;
}

export const toStudentSummary = (s: Pick<Student, 'studentId' | 'name' | 'classLevel' | 'section'>): StudentSummary => ({
  studentId: s.studentId,
  name: s.name,
  classLevel: s.classLevel,
  section: s.section,
});

export function marksOf(a: Pick<Assessment, (typeof COMPONENT_KEYS)[number]>): MarksInput {
  const marks = {} as MarksInput;
  for (const k of COMPONENT_KEYS) marks[k] = a[k] ?? null;
  return marks;
}

export function toAssessmentView(a: Assessment, opts: { audit: boolean }): AssessmentView {
  const marks = marksOf(a);
  const c = computeAssessment(marks);
  return {
    marks,
    subtotals: { chapter1: c.chapter1Subtotal, chapter2: c.chapter2Subtotal, textbook: c.textbookSubtotal },
    // Totals are always derived from the stored components, never trusted from a client.
    totalMarks: c.totalMarks,
    maxTotal: MAX_TOTAL,
    remaining: c.remaining,
    enteredCount: c.enteredCount,
    status: a.status,
    version: a.version,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    ...(opts.audit
      ? {
          createdBy: a.createdByName ?? a.createdBy?.fullName,
          updatedBy: a.updatedByName ?? a.updatedBy?.fullName,
        }
      : {}),
  };
}
