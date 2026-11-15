import ExcelJS from 'exceljs';
import { ParsedStudentRow, ParseResult, RowIssue } from './student-import.types';

type Primitive = string | number | boolean | null;

const MAX_INT = 2_147_483_647;
const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Excel cells can hold formulas, rich text and hyperlinks; reduce them to a plain value. */
export function cellPrimitive(v: ExcelJS.CellValue | undefined): Primitive {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    const o = v as unknown as Record<string, unknown>;
    if ('result' in o) return cellPrimitive(o.result as ExcelJS.CellValue);
    if (Array.isArray(o.richText)) return (o.richText as Array<{ text: string }>).map((t) => t.text).join('');
    if (typeof o.text === 'string') return o.text;
    return null; // error values etc.
  }
  return v as Primitive;
}

const isBlank = (v: Primitive) => v === null || (typeof v === 'string' && v.trim() === '');

function parsePositiveInt(v: Primitive, max: number): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v > 0 && v <= max ? v : null;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
    const n = Number(v.trim());
    return n > 0 && n <= max ? n : null;
  }
  return null;
}

export async function loadWorkbook(source: string | Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  if (typeof source === 'string') await wb.xlsx.readFile(source);
  else await wb.xlsx.load(source as unknown as ExcelJS.Buffer);
  return wb;
}

/**
 * Reads the student sheet without touching the database.
 * The header row is located by its column names, so extra title rows above it are fine.
 */
export function parseStudentSheet(wb: ExcelJS.Workbook): ParseResult {
  let ws: ExcelJS.Worksheet | undefined;
  let headerRow = 0;
  let cols: Record<string, number> = {};

  for (const sheet of wb.worksheets) {
    for (let r = 1; r <= Math.min(sheet.rowCount, 30); r++) {
      const found: Record<string, number> = {};
      sheet.getRow(r).eachCell({ includeEmpty: false }, (cell, c) => {
        const t = norm(cellPrimitive(cell.value));
        if (t) found[t] = c;
      });
      if (found['student id'] && found['name'] && found['class'] && found['section']) {
        ws = sheet;
        headerRow = r;
        cols = found;
        break;
      }
    }
    if (ws) break;
  }
  if (!ws) {
    throw new Error('Could not find a header row with the columns: Student ID, Name, Class, Section.');
  }

  // "Branch: …" and "Shift: …" title cells (information only).
  let school: string | null = null;
  let shift: string | null = null;
  for (let r = 1; r < headerRow; r++) {
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
      const t = String(cellPrimitive(cell.value) ?? '');
      const b = /^branch\s*:\s*(.+)$/i.exec(t.trim());
      const s = /^shift\s*:\s*(.+)$/i.exec(t.trim());
      if (b) school = b[1].trim();
      if (s) shift = s[1].trim();
    });
  }

  const legacyCols = Object.entries(cols).filter(([h]) => /^(first exam|assessment|final exam)\b/.test(h));
  const legacyNames = legacyCols.map(([h]) => h);

  const result: ParseResult = {
    school,
    shift,
    headerRow,
    rows: [],
    invalid: [],
    duplicatesInFile: [],
    warnings: [],
    emptyRowsSkipped: 0,
    legacyMarks: { columns: legacyNames, rowsWithValues: 0, cellsWithValues: 0 },
  };

  const seen = new Map<number, number>();
  // Blank rows are only counted when they sit between data rows (formatted-but-empty rows at the end are ignored).
  let pendingBlank = 0;
  const issue = (row: number, studentId: string | number | null, reason: string): RowIssue => ({ row, studentId, reason });

  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (h: string) => cellPrimitive(row.getCell(cols[h]).value);
    const idRaw = get('student id');
    const nameRaw = get('name');
    const classRaw = get('class');
    const sectionRaw = get('section');

    // Track (but never import) values in the legacy mark columns.
    let legacyCells = 0;
    for (const [, c] of legacyCols) if (!isBlank(cellPrimitive(row.getCell(c).value))) legacyCells++;

    if ([idRaw, nameRaw, classRaw, sectionRaw].every(isBlank)) {
      if (legacyCells === 0) pendingBlank++;
      else result.invalid.push(issue(r, null, 'Row has marks but no student identity'));
      continue;
    }
    result.emptyRowsSkipped += pendingBlank;
    pendingBlank = 0;
    if (legacyCells) {
      result.legacyMarks.rowsWithValues++;
      result.legacyMarks.cellsWithValues += legacyCells;
    }

    const problems: string[] = [];
    const studentId = isBlank(idRaw) ? null : parsePositiveInt(idRaw, MAX_INT);
    if (studentId === null) problems.push(isBlank(idRaw) ? 'Student ID is empty' : `Student ID "${idRaw}" is not a positive whole number`);

    let name = '';
    if (isBlank(nameRaw)) problems.push('Name is empty');
    else {
      const raw = String(nameRaw);
      name = raw.trim();
      if (!/\p{L}/u.test(name)) problems.push('Name has no letters');
      else if (name.length > 200) problems.push('Name is longer than 200 characters');
      else if (raw !== name) result.warnings.push(issue(r, studentId, 'Leading/trailing spaces were trimmed from the name'));
    }

    const classLevel = isBlank(classRaw) ? null : parsePositiveInt(classRaw, 99);
    if (classLevel === null) problems.push(isBlank(classRaw) ? 'Class is empty' : `Class "${classRaw}" is not a whole number between 1 and 99`);

    let section = '';
    if (isBlank(sectionRaw)) problems.push('Section is empty');
    else {
      const raw = String(sectionRaw);
      const up = raw.trim().toUpperCase();
      if (!/^[A-Z]$/.test(up)) problems.push(`Section "${raw}" must be a single letter A–Z`);
      else {
        section = up;
        if (up !== raw) result.warnings.push(issue(r, studentId, `Section "${raw}" was normalised to "${up}"`));
      }
    }

    if (problems.length) {
      result.invalid.push(issue(r, studentId ?? (isBlank(idRaw) ? null : String(idRaw)), problems.join('; ')));
      continue;
    }

    const firstRow = seen.get(studentId!);
    if (firstRow !== undefined) {
      result.duplicatesInFile.push(issue(r, studentId, `Duplicate Student ID (first seen on row ${firstRow}); this row was not imported`));
      continue;
    }
    seen.set(studentId!, r);
    const parsed: ParsedStudentRow = { rowNumber: r, studentId: studentId!, name, classLevel: classLevel!, section };
    result.rows.push(parsed);
  }
  return result;
}
