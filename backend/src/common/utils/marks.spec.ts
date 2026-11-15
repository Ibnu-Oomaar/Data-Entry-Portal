import { ASSESSMENT_COMPONENTS, COMPONENT_KEYS, GROUP_MAX, MAX_TOTAL, MarksInput } from '../constants/assessment';
import { computeAssessment, sameMarks, sumMarks } from './marks';

const empty = (): MarksInput => Object.fromEntries(COMPONENT_KEYS.map((k) => [k, null])) as MarksInput;
const full = (): MarksInput => Object.fromEntries(ASSESSMENT_COMPONENTS.map((c) => [c.key, c.max])) as MarksInput;

describe('assessment structure', () => {
  it('has exactly the seven agreed components with the agreed maximums', () => {
    expect(ASSESSMENT_COMPONENTS.map((c) => [c.key, c.max])).toEqual([
      ['chapter1Notes', 2],
      ['chapter1Exercises', 6],
      ['chapter1Assignment', 5],
      ['chapter2Notes', 2],
      ['chapter2Exercises', 6],
      ['chapter2Assignment', 5],
      ['textbook', 4],
    ]);
  });
  it('adds up to 30 overall and 13 / 13 / 4 per group', () => {
    expect(MAX_TOTAL).toBe(30);
    expect(GROUP_MAX).toEqual({ chapter1: 13, chapter2: 13, textbook: 4 });
    expect(ASSESSMENT_COMPONENTS.reduce((s, c) => s + c.max, 0)).toBe(30);
  });
});

describe('computeAssessment', () => {
  it('gives 30 and "submitted" when every component is at its maximum', () => {
    const c = computeAssessment(full());
    expect(c).toMatchObject({ chapter1Subtotal: 13, chapter2Subtotal: 13, textbookSubtotal: 4, totalMarks: 30, remaining: 0, enteredCount: 7, status: 'submitted' });
  });

  it('calculates subtotals and the total from the seven components', () => {
    const c = computeAssessment({
      chapter1Notes: 1,
      chapter1Exercises: 4,
      chapter1Assignment: 3,
      chapter2Notes: 2,
      chapter2Exercises: 5,
      chapter2Assignment: 4,
      textbook: 3,
    });
    expect(c.chapter1Subtotal).toBe(8);
    expect(c.chapter2Subtotal).toBe(11);
    expect(c.textbookSubtotal).toBe(3);
    expect(c.totalMarks).toBe(22);
    expect(c.remaining).toBe(8);
  });

  it('treats NULL as "not entered" (draft) and 0 as a real zero (counts as entered)', () => {
    expect(computeAssessment(empty())).toMatchObject({ totalMarks: 0, enteredCount: 0, status: 'draft', remaining: 30 });
    const allZero = Object.fromEntries(COMPONENT_KEYS.map((k) => [k, 0])) as MarksInput;
    expect(computeAssessment(allZero)).toMatchObject({ totalMarks: 0, enteredCount: 7, status: 'submitted', remaining: 30 });
    expect(computeAssessment({ ...empty(), chapter1Notes: 2 })).toMatchObject({ totalMarks: 2, enteredCount: 1, status: 'draft', remaining: 28 });
  });

  it('is exact with fractional marks (no floating point drift)', () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the problem we avoid
    expect(sumMarks([0.1, 0.2])).toBe(0.3);
    const c = computeAssessment({ ...empty(), chapter1Notes: 0.1, chapter1Exercises: 0.2, textbook: 1.15 });
    expect(c.totalMarks).toBe(1.45);
    expect(c.remaining).toBe(28.55);
  });
});

describe('sameMarks', () => {
  it('compares by value including nulls and decimals', () => {
    expect(sameMarks(full(), full())).toBe(true);
    expect(sameMarks(empty(), empty())).toBe(true);
    expect(sameMarks(full(), { ...full(), textbook: 3 })).toBe(false);
    expect(sameMarks({ ...empty(), textbook: 0 }, empty())).toBe(false); // 0 !== not entered
    expect(sameMarks({ ...empty(), textbook: 1.5 }, { ...empty(), textbook: 1.5 })).toBe(true);
  });
});
