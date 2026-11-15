/**
 * Canonical form used to match a typed teacher name against registered names:
 * Unicode NFKC, outer whitespace trimmed, inner whitespace collapsed, case-insensitive.
 */
export function normalizePersonName(input: string): string {
  return input.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Display form: same cleanup but keeps the original capitalisation. */
export function cleanDisplayName(input: string): string {
  return input.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** Escapes LIKE/ILIKE wildcards so user search text is treated literally. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}
