import { mkdirSync, writeFileSync } from 'fs';
import { basename, resolve } from 'path';
import { StudentImportService } from '../students/import/student-import.service';
import { runCli } from './cli-app';

const USAGE = `Usage: npm run import:students -- <workbook.xlsx> [--dry-run] [--report <file.json>]

  Imports student identity (Student ID, Name, Class, Section) from the school workbook.
  Safe to re-run: existing students are never duplicated or overwritten.
  --dry-run   validate and report without writing to the database
  --report    where to write the JSON report (default: ./import-reports/import-<timestamp>.json)`;

runCli(async (app) => {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.length === 0) {
    console.log(USAGE);
    return args.length === 0 ? 1 : 0;
  }
  const dryRun = args.includes('--dry-run');
  const reportIdx = args.indexOf('--report');
  const reportPath = reportIdx >= 0 ? args[reportIdx + 1] : undefined;
  const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--report');
  if (!file) {
    console.error('Missing workbook path.\n\n' + USAGE);
    return 1;
  }

  const importer = app.get(StudentImportService);
  const report = await importer.importFromWorkbook(resolve(file), { dryRun, label: basename(file) });

  const out = resolve(reportPath ?? `import-reports/import-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  mkdirSync(resolve(out, '..'), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));

  const t = report.totals;
  console.log(`\nImport report ${dryRun ? '(DRY RUN — nothing written)' : ''}`);
  console.log(`  Workbook      : ${report.file}  [${report.workbook.school ?? '?'} / ${report.workbook.shift ?? '?'}]`);
  console.log(`  Rows read     : ${t.rowsRead}   (empty rows skipped: ${t.emptyRowsSkipped})`);
  console.log(`  Valid rows    : ${t.validRows}`);
  console.log(`  Inserted      : ${t.inserted}${dryRun ? `   (would insert ${t.newStudents})` : ''}`);
  console.log(`  Already there : ${t.unchanged}   (identical, left untouched)`);
  console.log(`  Conflicts     : ${t.conflicts}   (differs from database — NOT overwritten)`);
  console.log(`  Invalid       : ${t.invalid}`);
  console.log(`  Duplicate IDs : ${t.duplicatesInFile}   (repeated inside the workbook)`);
  console.log(`  Warnings      : ${t.warnings}`);
  if (report.legacyMarksIgnored.cellsWithValues) {
    console.log(
      `  Legacy marks  : ${report.legacyMarksIgnored.cellsWithValues} value(s) in ${report.legacyMarksIgnored.columns.join(' / ')} were IGNORED (the portal uses the new 30-mark structure)`,
    );
  }
  console.log('\n  Class / section   rows   new');
  for (const g of report.byClassSection) {
    console.log(`  Class ${g.classLevel} / ${g.section}       ${String(g.rows).padStart(4)}   ${String(g.newStudents).padStart(3)}`);
  }
  for (const i of [...report.invalid, ...report.duplicatesInFile]) console.log(`  ✗ row ${i.row} (ID ${i.studentId ?? '?'}): ${i.reason}`);
  for (const c of report.conflicts) {
    console.log(`  ! row ${c.row} (ID ${c.studentId}): differs in ${c.fields.join(', ')} — db has ${JSON.stringify(c.existing)}, workbook has ${JSON.stringify(c.incoming)}`);
  }
  console.log(`\n  Full report: ${out}`);
  return report.success ? 0 : 2;
});
