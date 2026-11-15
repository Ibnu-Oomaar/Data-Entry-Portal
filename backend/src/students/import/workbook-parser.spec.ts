import ExcelJS from 'exceljs';
import { loadWorkbook, parseStudentSheet } from './workbook-parser';

async function build(rows: unknown[][], titleRows = true): Promise<ReturnType<typeof parseStudentSheet>> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Branch');
  if (titleRows) {
    ws.addRow(['Branch: Test School', null, null, null, null, 'Shift: Morning']);
    ws.addRow([]);
  }
  ws.addRow(['S/N', 'Student ID', 'Name', 'Class', 'Section', 'First Exam 30%', 'Assessment 30%', 'Final Exam 40%']);
  rows.forEach((r) => ws.addRow(r));
  const buf = (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  return parseStudentSheet(await loadWorkbook(Buffer.from(buf)));
}

describe('parseStudentSheet', () => {
  it('reads valid rows, the school/shift title cells, and finds the header below title rows', async () => {
    const r = await build([
      [1, 11516, 'Abdalle Daahir Abdi Warsame', 1, 'A'],
      [2, 9303, 'Amin Abdisamad Hashi Muhumed', 3, 'E'],
    ]);
    expect(r.school).toBe('Test School');
    expect(r.shift).toBe('Morning');
    expect(r.headerRow).toBe(3);
    expect(r.rows).toEqual([
      { rowNumber: 4, studentId: 11516, name: 'Abdalle Daahir Abdi Warsame', classLevel: 1, section: 'A' },
      { rowNumber: 5, studentId: 9303, name: 'Amin Abdisamad Hashi Muhumed', classLevel: 3, section: 'E' },
    ]);
    expect(r.invalid).toEqual([]);
  });

  it('preserves names exactly (no re-casing, internal spacing kept)', async () => {
    const r = await build([[1, 1, 'mohamed AHMED  ali', 1, 'A']]);
    expect(r.rows[0].name).toBe('mohamed AHMED  ali');
  });

  it('handles empty cells: blank rows are skipped, partly-empty rows are reported with the exact row', async () => {
    const r = await build([
      [1, 100, 'Valid One', 1, 'A'],
      [],
      [3, null, 'No Id', 1, 'A'],
      [4, 102, null, 1, 'A'],
      [5, 103, 'No Class', null, 'A'],
      [6, 104, 'No Section', 1, null],
    ]);
    expect(r.rows).toHaveLength(1);
    expect(r.emptyRowsSkipped).toBe(1);
    expect(r.invalid.map((i) => [i.row, i.reason])).toEqual([
      [6, 'Student ID is empty'],
      [7, 'Name is empty'],
      [8, 'Class is empty'],
      [9, 'Section is empty'],
    ]);
  });

  it('rejects malformed values instead of guessing', async () => {
    const r = await build([
      [1, 'ABC', 'Bad Id', 1, 'A'],
      [2, 12.5, 'Fractional Id', 1, 'A'],
      [3, -4, 'Negative Id', 1, 'A'],
      [4, 105, 'Bad Class', 'one', 'A'],
      [5, 106, 'Bad Section', 1, 'AB'],
      [6, 107, '1234', 1, 'A'],
    ]);
    expect(r.rows).toEqual([]);
    expect(r.invalid).toHaveLength(6);
    expect(r.invalid[0].reason).toMatch(/Student ID "ABC"/);
    expect(r.invalid[3].reason).toMatch(/Class "one"/);
    expect(r.invalid[4].reason).toMatch(/Section "AB"/);
    expect(r.invalid[5].reason).toMatch(/no letters/);
  });

  it('accepts IDs / classes stored as text and normalises section case with a warning', async () => {
    const r = await build([[1, '11516', 'Text Cells', '3', ' b ']]);
    expect(r.rows[0]).toMatchObject({ studentId: 11516, classLevel: 3, section: 'B' });
    expect(r.warnings.map((w) => w.reason)).toEqual([expect.stringContaining('normalised to "B"')]);
  });

  it('keeps the first of a duplicate Student ID and reports the rest', async () => {
    const r = await build([
      [1, 500, 'First Copy', 1, 'A'],
      [2, 500, 'Second Copy', 1, 'B'],
      [3, 501, 'Other', 1, 'A'],
    ]);
    expect(r.rows.map((x) => x.name)).toEqual(['First Copy', 'Other']);
    expect(r.duplicatesInFile).toEqual([{ row: 5, studentId: 500, reason: expect.stringContaining('first seen on row 4') }]);
  });

  it('reports (but never imports) values in the legacy First Exam / Assessment / Final Exam columns', async () => {
    const r = await build([
      [1, 600, 'Has Legacy', 1, 'A', null, 1, null],
      [2, 601, 'None', 1, 'A'],
    ]);
    expect(r.rows).toHaveLength(2);
    expect(r.legacyMarks).toMatchObject({ rowsWithValues: 1, cellsWithValues: 1 });
    expect(Object.keys(r.rows[0])).not.toContain('marks');
  });

  it('throws a clear error when the workbook has no student header', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('x').addRow(['foo', 'bar']);
    const buf = (await wb.xlsx.writeBuffer()) as unknown as Buffer;
    expect(() => parseStudentSheet(wb)).toThrow(/Student ID, Name, Class, Section/);
    void buf;
  });
});
