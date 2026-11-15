import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveAssessmentDto } from './save-assessment.dto';

const valid = {
  chapter1Notes: 2,
  chapter1Exercises: 6,
  chapter1Assignment: 5,
  chapter2Notes: 2,
  chapter2Exercises: 6,
  chapter2Assignment: 5,
  textbook: 4,
};

async function messages(payload: unknown): Promise<string[]> {
  const errors = await validate(plainToInstance(SaveAssessmentDto, payload), { whitelist: true, forbidNonWhitelisted: true });
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('SaveAssessmentDto', () => {
  it('accepts the maximum marks', async () => expect(await messages(valid)).toEqual([]));
  it('accepts zeros, decimals and nulls (= not entered)', async () => {
    expect(await messages({ ...valid, chapter1Notes: 0, chapter1Exercises: 2.5, textbook: null })).toEqual([]);
  });

  it.each([
    ['chapter1Notes', 2.01, 'Chapter 1 Notes cannot be more than 2'],
    ['chapter1Exercises', 7, 'Chapter 1 Exercises cannot be more than 6'],
    ['chapter1Assignment', 5.5, 'Chapter 1 Assignment cannot be more than 5'],
    ['chapter2Notes', 3, 'Chapter 2 Notes cannot be more than 2'],
    ['chapter2Exercises', 100, 'Chapter 2 Exercises cannot be more than 6'],
    ['chapter2Assignment', 6, 'Chapter 2 Assignment cannot be more than 5'],
    ['textbook', 4.1, 'Textbook cannot be more than 4'],
  ])('rejects %s above its maximum', async (key, value, message) => {
    expect(await messages({ ...valid, [key]: value })).toContain(message);
  });

  it('tells the caller a missing mark must be sent as null, and never treats it as "unchanged"', async () => {
    const { textbook: _omitted, ...withoutTextbook } = valid;
    expect(await messages(withoutTextbook)).toContain('Textbook is required — send null if it has not been entered yet');
  });

  it('rejects negative marks', async () => {
    expect(await messages({ ...valid, chapter2Notes: -0.5 })).toContain('Chapter 2 Notes cannot be negative');
  });

  it.each(['3', 'abc', true, [], {}, NaN, Infinity])('rejects non-numeric value %p', async (bad) => {
    expect((await messages({ ...valid, textbook: bad })).length).toBeGreaterThan(0);
  });

  it('rejects more than 2 decimal places', async () => {
    expect(await messages({ ...valid, chapter1Notes: 1.234 })).toEqual(
      expect.arrayContaining([expect.stringContaining('at most 2 decimal places')]),
    );
  });

  it('rejects a missing component instead of silently erasing it', async () => {
    const { textbook, ...partial } = valid;
    void textbook;
    expect((await messages(partial)).length).toBeGreaterThan(0);
  });

  it('rejects client-supplied totals / unknown fields', async () => {
    expect((await messages({ ...valid, totalMarks: 30 })).join()).toMatch(/totalMarks/);
  });
});
