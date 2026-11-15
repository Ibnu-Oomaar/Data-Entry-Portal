/**
 * The assessment structure is fixed by the school's business rules:
 * seven components, 30 marks in total. Do not change without a written decision.
 * (Mirrored in frontend/src/lib/assessment.ts — both are covered by tests.)
 */
export const ASSESSMENT_COMPONENTS = [
  { key: 'chapter1Notes', label: 'Chapter 1 Notes', group: 'chapter1', max: 2 },
  { key: 'chapter1Exercises', label: 'Chapter 1 Exercises', group: 'chapter1', max: 6 },
  { key: 'chapter1Assignment', label: 'Chapter 1 Assignment', group: 'chapter1', max: 5 },
  { key: 'chapter2Notes', label: 'Chapter 2 Notes', group: 'chapter2', max: 2 },
  { key: 'chapter2Exercises', label: 'Chapter 2 Exercises', group: 'chapter2', max: 6 },
  { key: 'chapter2Assignment', label: 'Chapter 2 Assignment', group: 'chapter2', max: 5 },
  { key: 'textbook', label: 'Textbook', group: 'textbook', max: 4 },
] as const;

export type ComponentKey = (typeof ASSESSMENT_COMPONENTS)[number]['key'];
export type ComponentGroup = (typeof ASSESSMENT_COMPONENTS)[number]['group'];
export type MarksInput = Record<ComponentKey, number | null>;

export const COMPONENT_KEYS = ASSESSMENT_COMPONENTS.map((c) => c.key) as ComponentKey[];
export const MAX_TOTAL = 30;
/** Fractional marks are accepted up to this many decimal places. */
export const MARK_DECIMALS = 2;

export const GROUP_MAX: Record<ComponentGroup, number> = {
  chapter1: 13,
  chapter2: 13,
  textbook: 4,
};

export type AssessmentStatus = 'draft' | 'submitted';
export type ListStatus = 'pending' | AssessmentStatus;

// Fail at start-up if someone edits the table above and breaks the 30-mark rule.
const sum = ASSESSMENT_COMPONENTS.reduce((s, c) => s + c.max, 0);
if (sum !== MAX_TOTAL) throw new Error(`Assessment components sum to ${sum}, expected ${MAX_TOTAL}`);
for (const g of Object.keys(GROUP_MAX) as ComponentGroup[]) {
  const gs = ASSESSMENT_COMPONENTS.filter((c) => c.group === g).reduce((s, c) => s + c.max, 0);
  if (gs !== GROUP_MAX[g]) throw new Error(`Group ${g} sums to ${gs}, expected ${GROUP_MAX[g]}`);
}
