import {
  ASSESSMENT_COMPONENTS,
  AssessmentStatus,
  COMPONENT_KEYS,
  GROUP_MAX,
  MAX_TOTAL,
  MarksInput,
} from '../constants/assessment';

/** Marks are summed as integer hundredths so 0.1 + 0.2 never produces 0.30000000000000004. */
const toHundredths = (n: number) => Math.round(n * 100);
const fromHundredths = (n: number) => n / 100;

export function sumMarks(values: Array<number | null | undefined>): number {
  return fromHundredths(values.reduce<number>((s, v) => s + (v == null ? 0 : toHundredths(v)), 0));
}

export interface ComputedAssessment {
  chapter1Subtotal: number;
  chapter2Subtotal: number;
  textbookSubtotal: number;
  totalMarks: number;
  remaining: number;
  enteredCount: number;
  status: AssessmentStatus;
}

export function computeAssessment(marks: MarksInput): ComputedAssessment {
  const groupSum = (g: 'chapter1' | 'chapter2' | 'textbook') =>
    sumMarks(ASSESSMENT_COMPONENTS.filter((c) => c.group === g).map((c) => marks[c.key]));
  const chapter1Subtotal = groupSum('chapter1');
  const chapter2Subtotal = groupSum('chapter2');
  const textbookSubtotal = groupSum('textbook');
  const totalMarks = sumMarks([chapter1Subtotal, chapter2Subtotal, textbookSubtotal]);
  const enteredCount = COMPONENT_KEYS.filter((k) => marks[k] != null).length;
  return {
    chapter1Subtotal,
    chapter2Subtotal,
    textbookSubtotal,
    totalMarks,
    remaining: fromHundredths(toHundredths(MAX_TOTAL) - toHundredths(totalMarks)),
    enteredCount,
    status: enteredCount === COMPONENT_KEYS.length ? 'submitted' : 'draft',
  };
}

export function sameMarks(a: MarksInput, b: MarksInput): boolean {
  return COMPONENT_KEYS.every((k) => (a[k] == null ? null : toHundredths(a[k] as number)) === (b[k] == null ? null : toHundredths(b[k] as number)));
}

export function assertGroupLimits(c: ComputedAssessment): void {
  if (
    c.chapter1Subtotal > GROUP_MAX.chapter1 ||
    c.chapter2Subtotal > GROUP_MAX.chapter2 ||
    c.textbookSubtotal > GROUP_MAX.textbook ||
    c.totalMarks > MAX_TOTAL
  ) {
    // Unreachable when per-component limits are enforced; kept as a last line of defence.
    throw new Error('Computed marks exceed the permitted maximum');
  }
}
