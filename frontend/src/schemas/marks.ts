import { z } from 'zod';
import { COMPONENTS, parseMark } from '@/lib/assessment';
import type { ComponentKey } from '@/types/api';

/**
 * Form schema for the seven mark inputs. Fields hold what the teacher typed (strings);
 * each is checked against its own maximum with the same rules and wording as the server.
 */
const field = (key: ComponentKey) => {
  const def = COMPONENTS.find((c) => c.key === key)!;
  return z.string().superRefine((raw, ctx) => {
    const r = parseMark(raw, def);
    if (!r.ok) ctx.addIssue({ code: 'custom', message: r.message });
  });
};

export const marksFormSchema = z.object({
  chapter1Notes: field('chapter1Notes'),
  chapter1Exercises: field('chapter1Exercises'),
  chapter1Assignment: field('chapter1Assignment'),
  chapter2Notes: field('chapter2Notes'),
  chapter2Exercises: field('chapter2Exercises'),
  chapter2Assignment: field('chapter2Assignment'),
  textbook: field('textbook'),
});

export type MarksFormValues = z.infer<typeof marksFormSchema>;
