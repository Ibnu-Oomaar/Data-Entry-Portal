export type Role = 'teacher' | 'student';
export type ComponentKey =
  | 'chapter1Notes'
  | 'chapter1Exercises'
  | 'chapter1Assignment'
  | 'chapter2Notes'
  | 'chapter2Exercises'
  | 'chapter2Assignment'
  | 'textbook';
export type Marks = Record<ComponentKey, number | null>;
export type ListStatus = 'pending' | 'draft' | 'submitted';
export type AssessmentStatus = 'draft' | 'submitted';

export interface School {
  name: string;
  shift: string;
}

export interface TeacherSession {
  role: 'teacher';
  user: { fullName: string };
  csrfToken: string;
  school: School;
  expiresAt: string | null;
}

export interface StudentSession {
  role: 'student';
  user: { studentId: number; name: string; classLevel: number; section: string };
  csrfToken: string;
  school: School;
  expiresAt: string | null;
}

export type Session = TeacherSession | StudentSession;

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

export interface StudentSummary {
  studentId: number;
  name: string;
  classLevel: number;
  section: string;
}

export interface StudentListItem extends StudentSummary {
  status: ListStatus;
  totalMarks: number | null;
  version: number | null;
  updatedAt: string | null;
}

export interface AssessmentView {
  marks: Marks;
  subtotals: { chapter1: number; chapter2: number; textbook: number };
  totalMarks: number;
  maxTotal: number;
  remaining: number;
  enteredCount: number;
  status: AssessmentStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface StudentAssessment {
  student: StudentSummary;
  assessment: AssessmentView | null;
}

export interface SaveResult extends StudentAssessment {
  created: boolean;
  unchanged: boolean;
}

export interface SaveAssessmentPayload extends Marks {
  expectedVersion?: number | null;
}

export interface AssessmentRecordRow extends StudentSummary {
  marks: Marks;
  totalMarks: number;
  status: AssessmentStatus;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SectionSummary {
  section: string;
  students: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  average: number | null;
  completionPercent?: number;
}

export interface ClassSummary {
  classLevel: number;
  students: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  average: number | null;
  completionPercent?: number;
  sections: SectionSummary[];
}

export interface ActivityItem {
  studentId: number;
  studentName: string;
  classLevel: number;
  section: string;
  status: AssessmentStatus;
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
    pending: number;
    completionPercent: number;
    average: number | null;
    highest: number | null;
    lowest: number | null;
  };
  classes: Array<ClassSummary & { completionPercent: number; sections: Array<SectionSummary & { completionPercent: number }> }>;
  distribution: Array<{ label: string; from: number; to: number; count: number }>;
  recentActivity: ActivityItem[];
}

export interface TeacherActivity {
  assessmentsCreated: number;
  assessmentsLastEditedByMe: number;
  lastActivityAt: string | null;
  recent: Array<{
    studentId: number;
    studentName: string;
    classLevel: number;
    section: string;
    status: AssessmentStatus;
    totalMarks: number;
    at: string;
  }>;
}

export type StudentSortField = 'classSection' | 'studentId' | 'name' | 'classLevel' | 'section' | 'totalMarks' | 'status' | 'updatedAt';

export interface StudentQuery {
  classLevel?: number;
  section?: string;
  status?: ListStatus;
  search?: string;
  sortBy?: StudentSortField;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
