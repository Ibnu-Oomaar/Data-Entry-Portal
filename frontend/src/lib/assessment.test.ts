import { describe, expect, it } from 'vitest';
import { COMPONENTS, GROUPS, MAX_TOTAL, computeTotals, formatMark, marksToFormValues, parseMark, sumMarks } from './assessment';

const def = (key: string) => COMPONENTS.find((c) => c.key === key)!;

describe('assessment structure (fixed by the school)', () => {
  it('has exactly seven components in the agreed order', () => {
    expect(COMPONENTS.map((c) => [c.key, c.max])).toEqual([
      ['chapter1Notes', 2],
      ['chapter1Exercises', 6],
      ['chapter1Assignment', 5],
      ['chapter2Notes', 2],
      ['chapter2Exercises', 6],
      ['chapter2Assignment', 5],
      ['textbook', 4],
    ]);
  });

  it('adds up to 30 marks: Chapter 1 = 13, Chapter 2 = 13, Textbook = 4', () => {
    expect(MAX_TOTAL).toBe(30);
    expect(COMPONENTS.reduce((s, c) => s + c.max, 0)).toBe(30);
    expect(GROUPS.map((g) => [g.key, g.max])).toEqual([
      ['chapter1', 13],
      ['chapter2', 13],
      ['textbook', 4],
    ]);
    for (const g of GROUPS) expect(COMPONENTS.filter((c) => c.group === g.key).reduce((s, c) => s + c.max, 0)).toBe(g.max);
  });
});

describe('parseMark', () => {
  const notes = def('chapter1Notes'); // max 2

  it('treats blank as "not entered" (null), not zero', () => {
    expect(parseMark('', notes)).toEqual({ ok: true, value: null });
    expect(parseMark('   ', notes)).toEqual({ ok: true, value: null });
  });

  it('keeps a real zero', () => {
    expect(parseMark('0', notes)).toEqual({ ok: true, value: 0 });
  });

  it('accepts whole numbers, decimals and a decimal comma', () => {
    expect(parseMark('2', notes)).toEqual({ ok: true, value: 2 });
    expect(parseMark('1.5', notes)).toEqual({ ok: true, value: 1.5 });
    expect(parseMark('1,5', notes)).toEqual({ ok: true, value: 1.5 });
    expect(parseMark('1.25', notes)).toEqual({ ok: true, value: 1.25 });
    expect(parseMark('.5', notes)).toEqual({ ok: true, value: 0.5 });
  });

  it('rejects negatives, over-maximum values, junk and too many decimals', () => {
    expect(parseMark('-1', notes)).toEqual({ ok: false, message: 'Chapter 1 Notes cannot be negative' });
    expect(parseMark('2.01', notes)).toEqual({ ok: false, message: 'Chapter 1 Notes cannot be more than 2' });
    expect(parseMark('3', notes)).toEqual({ ok: false, message: 'Chapter 1 Notes cannot be more than 2' });
    expect(parseMark('abc', notes)).toEqual({ ok: false, message: 'Chapter 1 Notes must be a number' });
    expect(parseMark('1e1', notes).ok).toBe(false);
    expect(parseMark('1.2.3', notes).ok).toBe(false);
    expect(parseMark('1.234', notes)).toEqual({ ok: false, message: 'Chapter 1 Notes can have at most 2 decimal places' });
  });

  it('enforces each component’s own maximum', () => {
    expect(parseMark('6', def('chapter1Exercises')).ok).toBe(true);
    expect(parseMark('7', def('chapter1Exercises')).ok).toBe(false);
    expect(parseMark('5', def('chapter2Assignment')).ok).toBe(true);
    expect(parseMark('5.01', def('chapter2Assignment')).ok).toBe(false);
    expect(parseMark('4', def('textbook')).ok).toBe(true);
    expect(parseMark('4.5', def('textbook')).ok).toBe(false);
  });
});

describe('totals', () => {
  it('adds in hundredths so floating point never leaks into a mark', () => {
    expect(sumMarks([0.1, 0.2])).toBe(0.3);
    expect(sumMarks([1.1, 2.2, 3.3])).toBe(6.6);
    expect(sumMarks([null, undefined, 1])).toBe(1);
  });

  it('computes subtotals, total and remaining for a full sheet', () => {
    const t = computeTotals({ chapter1Notes: 2, chapter1Exercises: 5.5, chapter1Assignment: 4, chapter2Notes: 1.5, chapter2Exercises: 6, chapter2Assignment: 5, textbook: 3 });
    expect(t).toMatchObject({ chapter1: 11.5, chapter2: 12.5, textbook: 3, total: 27, remaining: 3, entered: 7, complete: true });
  });

  it('a perfect sheet is 30 with nothing remaining', () => {
    const t = computeTotals({ chapter1Notes: 2, chapter1Exercises: 6, chapter1Assignment: 5, chapter2Notes: 2, chapter2Exercises: 6, chapter2Assignment: 5, textbook: 4 });
    expect(t.total).toBe(30);
    expect(t.remaining).toBe(0);
  });

  it('a partial sheet is not complete and counts only entered parts', () => {
    const t = computeTotals({ chapter1Notes: 1, textbook: 0 });
    expect(t).toMatchObject({ total: 1, entered: 2, complete: false, remaining: 29 });
  });

  it('an empty sheet is 0 of 30 with nothing entered', () => {
    expect(computeTotals({})).toMatchObject({ total: 0, entered: 0, complete: false, remaining: 30 });
  });
});

describe('display helpers', () => {
  it('formats marks without trailing zeros and shows a dash for "not entered"', () => {
    expect(formatMark(22)).toBe('22');
    expect(formatMark(1.5)).toBe('1.5');
    expect(formatMark(1.45)).toBe('1.45');
    expect(formatMark(0)).toBe('0');
    expect(formatMark(null)).toBe('—');
  });

  it('turns saved marks into form strings, keeping 0 and leaving blanks empty', () => {
    const v = marksToFormValues({ chapter1Notes: 0, chapter1Exercises: null, chapter1Assignment: 4.5, chapter2Notes: null, chapter2Exercises: null, chapter2Assignment: null, textbook: 3 });
    expect(v).toMatchObject({ chapter1Notes: '0', chapter1Exercises: '', chapter1Assignment: '4.5', textbook: '3' });
    expect(Object.keys(marksToFormValues(null))).toHaveLength(7);
  });
});
