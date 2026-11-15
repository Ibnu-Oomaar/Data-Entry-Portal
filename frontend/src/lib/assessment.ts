import type { ComponentKey, Marks } from '@/types/api';

/**
 * The assessment structure is fixed by the school: seven components, 30 marks in total.
 * Mirrors backend/src/common/constants/assessment.ts (both sides have tests that pin these numbers).
 * The server remains the authority: it re-validates and recalculates everything.
 */
export type GroupKey = 'chapter1' | 'chapter2' | 'textbook';

export interface ComponentDef {
  key: ComponentKey;
  label: string;
  short: string;
  group: GroupKey;
  max: number;
}

export const COMPONENTS: readonly ComponentDef[] = [
  { key: 'chapter1Notes', label: 'Chapter 1 Notes', short: 'Notes', group: 'chapter1', max: 2 },
  { key: 'chapter1Exercises', label: 'Chapter 1 Exercises', short: 'Exercises', group: 'chapter1', max: 6 },
  { key: 'chapter1Assignment', label: 'Chapter 1 Assignment', short: 'Assignment', group: 'chapter1', max: 5 },
  { key: 'chapter2Notes', label: 'Chapter 2 Notes', short: 'Notes', group: 'chapter2', max: 2 },
  { key: 'chapter2Exercises', label: 'Chapter 2 Exercises', short: 'Exercises', group: 'chapter2', max: 6 },
  { key: 'chapter2Assignment', label: 'Chapter 2 Assignment', short: 'Assignment', group: 'chapter2', max: 5 },
  { key: 'textbook', label: 'Textbook', short: 'Textbook', group: 'textbook', max: 4 },
] as const;

export const GROUPS: ReadonlyArray<{ key: GroupKey; label: string; max: number }> = [
  { key: 'chapter1', label: 'Chapter 1', max: 13 },
  { key: 'chapter2', label: 'Chapter 2', max: 13 },
  { key: 'textbook', label: 'Textbook', max: 4 },
];

export const MAX_TOTAL = 30;
export const MARK_DECIMALS = 2;
export const COMPONENT_KEYS = COMPONENTS.map((c) => c.key);

const hundredths = (n: number) => Math.round(n * 100);

/** Exact sum of marks (integer hundredths, so 0.1 + 0.2 is 0.3). Blank = not entered = 0. */
export function sumMarks(values: Array<number | null | undefined>): number {
  return values.reduce<number>((s, v) => s + (v == null ? 0 : hundredths(v)), 0) / 100;
}

export interface Totals {
  chapter1: number;
  chapter2: number;
  textbook: number;
  total: number;
  remaining: number;
  entered: number;
  complete: boolean;
}

export function computeTotals(marks: Partial<Record<ComponentKey, number | null>>): Totals {
  const group = (g: GroupKey) => sumMarks(COMPONENTS.filter((c) => c.group === g).map((c) => marks[c.key]));
  const chapter1 = group('chapter1');
  const chapter2 = group('chapter2');
  const textbook = group('textbook');
  const total = sumMarks([chapter1, chapter2, textbook]);
  const entered = COMPONENTS.filter((c) => marks[c.key] != null).length;
  return { chapter1, chapter2, textbook, total, remaining: (hundredths(MAX_TOTAL) - hundredths(total)) / 100, entered, complete: entered === COMPONENTS.length };
}

export type ParsedMark = { ok: true; value: number | null } | { ok: false; message: string };

/**
 * Turns what a teacher typed into a mark. Blank means "not entered yet" (null); 0 is a real zero.
 * Accepts a decimal comma ("1,5"). Messages match the server's so the same words appear either way.
 */
export function parseMark(raw: string, def: Pick<ComponentDef, 'label' | 'max'>): ParsedMark {
  const text = raw.trim().replace(',', '.');
  if (text === '') return { ok: true, value: null };
  if (!/^-?\d+(\.\d*)?$|^-?\.\d+$/.test(text)) return { ok: false, message: `${def.label} must be a number` };
  const value = Number(text);
  if (value < 0) return { ok: false, message: `${def.label} cannot be negative` };
  const decimals = text.split('.')[1]?.replace(/0+$/, '') ?? '';
  if (decimals.length > MARK_DECIMALS) return { ok: false, message: `${def.label} can have at most ${MARK_DECIMALS} decimal places` };
  if (value > def.max) return { ok: false, message: `${def.label} cannot be more than ${def.max}` };
  return { ok: true, value };
}

/** 22 -> "22", 1.45 -> "1.45", 1.5 -> "1.5" */
export const formatMark = (n: number | null | undefined): string => (n == null ? '—' : String(Math.round(n * 100) / 100));

export function marksToFormValues(marks: Marks | null | undefined): Record<ComponentKey, string> {
  const out = {} as Record<ComponentKey, string>;
  for (const c of COMPONENTS) out[c.key] = marks?.[c.key] == null ? '' : String(marks[c.key]);
  return out;
}
