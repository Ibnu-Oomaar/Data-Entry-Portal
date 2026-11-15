import { describe, expect, it } from 'vitest';
import { marksFormSchema } from './marks';

const blank = { chapter1Notes: '', chapter1Exercises: '', chapter1Assignment: '', chapter2Notes: '', chapter2Exercises: '', chapter2Assignment: '', textbook: '' };

describe('marksFormSchema', () => {
  it('accepts a sheet of blanks (the "at least one mark" rule is applied on save)', () => {
    expect(marksFormSchema.safeParse(blank).success).toBe(true);
  });
  it('accepts valid marks', () => {
    expect(marksFormSchema.safeParse({ ...blank, chapter1Notes: '2', chapter1Exercises: '5.5', textbook: '0' }).success).toBe(true);
  });
  it('reports each invalid field with the server-style message', () => {
    const r = marksFormSchema.safeParse({ ...blank, chapter1Notes: '3', chapter1Exercises: '-1', textbook: 'x' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const byField = Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]));
      expect(byField).toEqual({
        chapter1Notes: 'Chapter 1 Notes cannot be more than 2',
        chapter1Exercises: 'Chapter 1 Exercises cannot be negative',
        textbook: 'Textbook must be a number',
      });
    }
  });
});
