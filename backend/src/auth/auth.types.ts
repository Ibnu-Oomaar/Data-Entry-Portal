import 'express-session';

export type Role = 'teacher' | 'student';

export interface TeacherUser {
  role: 'teacher';
  id: string;
  fullName: string;
}

export interface StudentUser {
  role: 'student';
  id: string;
  studentId: number;
  name: string;
  classLevel: number;
  section: string;
}

export type AuthUser = TeacherUser | StudentUser;

declare module 'express-session' {
  interface SessionData {
    user?: { role: Role; id: string };
    csrfToken?: string;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthUser;
  }
}
