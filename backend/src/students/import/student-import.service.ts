import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { Student } from '../student.entity';
import { ImportConflict, ImportReport, ParseResult } from './student-import.types';
import { loadWorkbook, parseStudentSheet } from './workbook-parser';

const CHUNK = 200;

@Injectable()
export class StudentImportService {
  private readonly logger = new Logger(StudentImportService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Imports students from the workbook. Safe to run repeatedly:
   *  - new Student IDs are inserted,
   *  - identical rows are left alone,
   *  - rows whose name/class/section differ from the database are REPORTED as conflicts and never overwritten.
   */
  async importFromWorkbook(source: string | Buffer, opts: { dryRun?: boolean; label?: string } = {}): Promise<ImportReport> {
    const startedAt = new Date();
    const wb = await loadWorkbook(source);
    const parsed = parseStudentSheet(wb);
    return this.apply(parsed, { ...opts, startedAt, file: opts.label ?? (typeof source === 'string' ? source : 'upload') });
  }

  async apply(
    parsed: ParseResult,
    opts: { dryRun?: boolean; startedAt?: Date; file: string },
  ): Promise<ImportReport> {
    const startedAt = opts.startedAt ?? new Date();
    const dryRun = !!opts.dryRun;
    const repo = this.dataSource.getRepository(Student);

    const existing = new Map<number, Student>();
    const ids = parsed.rows.map((r) => r.studentId);
    for (let i = 0; i < ids.length; i += 1000) {
      for (const s of await repo.find({ where: { studentId: In(ids.slice(i, i + 1000)) } })) existing.set(s.studentId, s);
    }

    const toInsert: ParseResult['rows'] = [];
    const conflicts: ImportConflict[] = [];
    let unchanged = 0;
    for (const row of parsed.rows) {
      const current = existing.get(row.studentId);
      if (!current) {
        toInsert.push(row);
        continue;
      }
      const fields: string[] = [];
      if (current.name !== row.name) fields.push('name');
      if (current.classLevel !== row.classLevel) fields.push('classLevel');
      if (current.section !== row.section) fields.push('section');
      if (fields.length === 0) unchanged++;
      else {
        conflicts.push({
          row: row.rowNumber,
          studentId: row.studentId,
          fields,
          existing: { name: current.name, classLevel: current.classLevel, section: current.section },
          incoming: { name: row.name, classLevel: row.classLevel, section: row.section },
        });
      }
    }

    if (!dryRun && toInsert.length) {
      // One transaction: either every new student is stored or none are.
      await this.dataSource.transaction(async (em) => {
        for (let i = 0; i < toInsert.length; i += CHUNK) {
          await em.insert(
            Student,
            toInsert.slice(i, i + CHUNK).map((r) => ({
              studentId: r.studentId,
              name: r.name,
              classLevel: r.classLevel,
              section: r.section,
            })),
          );
        }
      });
    }

    const groups = new Map<string, { classLevel: number; section: string; rows: number; newStudents: number }>();
    for (const r of parsed.rows) {
      const key = `${r.classLevel}|${r.section}`;
      const g = groups.get(key) ?? { classLevel: r.classLevel, section: r.section, rows: 0, newStudents: 0 };
      g.rows++;
      groups.set(key, g);
    }
    for (const r of toInsert) groups.get(`${r.classLevel}|${r.section}`)!.newStudents++;

    const report: ImportReport = {
      success: parsed.invalid.length === 0 && parsed.duplicatesInFile.length === 0 && conflicts.length === 0,
      dryRun,
      file: opts.file,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      workbook: { school: parsed.school, shift: parsed.shift, headerRow: parsed.headerRow },
      totals: {
        rowsRead: parsed.rows.length + parsed.invalid.length + parsed.duplicatesInFile.length,
        validRows: parsed.rows.length,
        newStudents: toInsert.length,
        inserted: dryRun ? 0 : toInsert.length,
        unchanged,
        conflicts: conflicts.length,
        invalid: parsed.invalid.length,
        duplicatesInFile: parsed.duplicatesInFile.length,
        emptyRowsSkipped: parsed.emptyRowsSkipped,
        warnings: parsed.warnings.length,
      },
      byClassSection: [...groups.values()].sort((a, b) => a.classLevel - b.classLevel || a.section.localeCompare(b.section)),
      legacyMarksIgnored: parsed.legacyMarks,
      invalid: parsed.invalid,
      duplicatesInFile: parsed.duplicatesInFile,
      conflicts,
      warnings: parsed.warnings,
    };
    this.logger.log(
      `${dryRun ? '[dry-run] ' : ''}import finished: ${report.totals.inserted} inserted, ${unchanged} unchanged, ${conflicts.length} conflicts, ${parsed.invalid.length} invalid`,
    );
    return report;
  }
}
