import { z } from 'zod';

export const teacherLoginSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(150, 'That name is too long'),
  password: z.string().min(12, 'Use at least 12 characters').max(128, 'Password must be no more than 128 characters'),
});
export type TeacherLoginValues = z.infer<typeof teacherLoginSchema>;

export const studentLoginSchema = z.object({
  studentId: z
    .string()
    .trim()
    .min(1, 'Enter your Student ID')
    .regex(/^\d+$/, 'A Student ID is a number, like 11516')
    .max(9, 'That Student ID is too long'),
});
export type StudentLoginValues = z.infer<typeof studentLoginSchema>;
