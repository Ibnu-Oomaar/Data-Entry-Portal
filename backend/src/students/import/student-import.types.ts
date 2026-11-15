export interface ParsedStudentRow {
  /** 1-based Excel row number, so reports can point at the exact line to fix. */
  rowNumber: number;
  studentId: number;
  name: string;
  classLevel: number;
  section: string;
}

export interface RowIssue {
  row: number;
  studentId: string | number | null;
  reason: string;
}

export interface ParseResult {
  school: string | null;
  shift: string | null;
  headerRow: number;
  rows: ParsedStudentRow[];
  invalid: RowIssue[];
  duplicatesInFile: RowIssue[];
  warnings: RowIssue[];
  emptyRowsSkipped: number;
  /** The old First Exam / Assessment / Final Exam columns are never imported. */
  legacyMarks: { columns: string[]; rowsWithValues: number; cellsWithValues: number };
}

export interface ImportConflict {
  row: number;
  studentId: number;
  fields: string[];
  existing: { name: string; classLevel: number; section: string };
  incoming: { name: string; classLevel: number; section: string };
}

export interface ImportReport {
  success: boolean;
  dryRun: boolean;
  file: string;
  startedAt: string;
  finishedAt: string;
  workbook: { school: string | null; shift: string | null; headerRow: number };
  totals: {
    rowsRead: number;
    validRows: number;
    /** Rows whose Student ID is not in the database yet (what a dry run would insert). */
    newStudents: number;
    /** Rows actually written (0 on a dry run). */
    inserted: number;
    unchanged: number;
    conflicts: number;
    invalid: number;
    duplicatesInFile: number;
    emptyRowsSkipped: number;
    warnings: number;
  };
  byClassSection: Array<{ classLevel: number; section: string; rows: number; newStudents: number }>;
  legacyMarksIgnored: ParseResult['legacyMarks'];
  invalid: RowIssue[];
  duplicatesInFile: RowIssue[];
  conflicts: ImportConflict[];
  warnings: RowIssue[];
}
