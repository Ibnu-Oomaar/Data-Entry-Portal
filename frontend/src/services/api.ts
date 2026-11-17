import { api } from './api-client';
import type {
  AssessmentRecordRow,
  ClassSummary,
  Overview,
  Paged,
  PageMeta,
  SaveAssessmentPayload,
  SaveResult,
  School,
  Session,
  StudentAssessment,
  StudentListItem,
  StudentQuery,
  TeacherActivity,
} from '@/types/api';

type Envelope<T> = { success: true; data: T; meta?: PageMeta };

const unwrap = <T>(res: { data: Envelope<T> }): T => res.data.data;
const unwrapPage = <T>(res: { data: Envelope<T[]> }): Paged<T> => ({ items: res.data.data, meta: res.data.meta! });

const TEACHER_LOGIN_NAME = 'Khalid Harun';

/** Drops empty values so the URL and the request stay clean. */
const clean = (q: StudentQuery) =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== '' && v !== null));

export const authApi = {
  me: () => api.get<Envelope<Session>>('/auth/me').then(unwrap),
  loginTeacher: (password: string) =>
    api.post<Envelope<Session>>('/auth/teacher/login', { name: TEACHER_LOGIN_NAME, password }).then(unwrap),
  loginStudent: (studentId: number) => api.post<Envelope<Session>>('/auth/student/login', { studentId }).then(unwrap),
  logout: () => api.post('/auth/logout').then(() => undefined),
};

export const schoolApi = {
  get: () => api.get<Envelope<School>>('/school').then(unwrap),
};

export const studentsApi = {
  list: (q: StudentQuery) => api.get<Envelope<StudentListItem[]>>('/students', { params: clean(q) }).then(unwrapPage),
  structure: () => api.get<Envelope<ClassSummary[]>>('/students/structure').then(unwrap),
  export: (q: StudentQuery) => api.get<Blob>('/students/export', { params: clean(q), responseType: 'blob' }).then((res) => res.data),
};

export const assessmentsApi = {
  get: (studentId: number, scope: Pick<StudentQuery, 'classLevel' | 'section'>) =>
    api.get<Envelope<StudentAssessment>>(`/assessments/student/${studentId}`, { params: clean(scope) }).then(unwrap),
  save: (studentId: number, payload: SaveAssessmentPayload, scope: Pick<StudentQuery, 'classLevel' | 'section'>) =>
    api.put<Envelope<SaveResult>>(`/assessments/student/${studentId}`, payload, { params: clean(scope) }).then(unwrap),
  list: (q: StudentQuery) => api.get<Envelope<AssessmentRecordRow[]>>('/assessments', { params: clean(q) }).then(unwrapPage),
  export: (q: StudentQuery) => api.get<Blob>('/assessments/export', { params: clean(q), responseType: 'blob' }).then((res) => res.data),
  own: () => api.get<Envelope<StudentAssessment>>('/me/assessment').then(unwrap),
};

export const statsApi = {
  overview: () => api.get<Envelope<Overview>>('/stats/overview').then(unwrap),
  me: () => api.get<Envelope<TeacherActivity>>('/stats/me').then(unwrap),
};
