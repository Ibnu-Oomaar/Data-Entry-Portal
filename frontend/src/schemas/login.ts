import { z } from 'zod';

export const studentLoginSchema = z.object({
  studentId: z
    .string()
    .trim()
    .min(1, 'Enter your Student ID')
    .regex(/^\d+$/, 'A Student ID is a number, like 11516')
    .max(9, 'That Student ID is too long'),
});
export type StudentLoginValues = z.infer<typeof studentLoginSchema>;
