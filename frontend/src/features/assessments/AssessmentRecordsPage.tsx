import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ClipboardList, PencilLine, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { ExcelExportButton } from '@/components/common/ExcelExportButton';
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { COMPONENTS, GROUPS, formatMark } from '@/lib/assessment';
import { classLabel, cn, firstName, timeAgo } from '@/lib/utils';
import { StudentFilterBar } from '@/features/students/StudentFilterBar';
import { SortHeader, TablePager } from '@/features/students/table-bits';
import { useStudentFilters } from '@/hooks/useStudentFilters';
import { useStructure } from '@/hooks/useStructure';
import { assessmentsApi } from '@/services/api';
import type { AssessmentRecordRow, StudentSortField } from '@/types/api';

const DEFAULTS = { sortBy: 'updatedAt', sortDir: 'desc', pageSize: 50 } as const;
const SORT_FIELDS: StudentSortField[] = ['updatedAt', 'classSection', 'name', 'studentId', 'totalMarks', 'status'];
const entryLink = (r: AssessmentRecordRow) => `/teacher/marks?student=${r.studentId}&class=${r.classLevel}&section=${r.section}`;

/** Everyone who has marks saved: all seven components, the total, and who entered/updated them. */
export function AssessmentRecordsPage() {
  const { filters, query, update, reset, isFiltered } = useStudentFilters(DEFAULTS);
  const structure = useStructure();
  const list = useQuery({ queryKey: ['assessments', query], queryFn: () => assessmentsApi.list(query), placeholderData: keepPreviousData });
  const meta = list.data?.meta;

  const onSort = (field: StudentSortField) => {
    const same = filters.sortBy === field;
    update({ sortBy: field, sortDir: same ? (filters.sortDir === 'asc' ? 'desc' : 'asc') : field === 'updatedAt' || field === 'totalMarks' ? 'desc' : 'asc' });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assessment records"
        description={meta ? `${meta.total} saved ${meta.total === 1 ? 'assessment' : 'assessments'}. Completed means all seven parts are entered.` : 'Loading…'}
        actions={
          <>
            <ExcelExportButton download={() => assessmentsApi.export(query)} filename="assessment-records.xlsx" />
            <Button asChild>
              <Link to="/teacher/marks">
                <PencilLine aria-hidden /> Enter marks
              </Link>
            </Button>
          </>
        }
      />

      <Card className="p-4 sm:p-5">
        <StudentFilterBar filters={filters} update={update} reset={reset} isFiltered={isFiltered} structure={structure.data} sortFields={SORT_FIELDS} hideStatusPending />
      </Card>

      <Card className="overflow-hidden">
        {list.isError ? (
          <ErrorState message={(list.error as Error).message} onRetry={() => list.refetch()} />
        ) : list.isPending ? (
          <RowsSkeleton rows={8} />
        ) : list.data.items.length === 0 ? (
          <EmptyState
            icon={isFiltered ? SearchX : ClipboardList}
            title={isFiltered ? 'No saved assessments match' : 'No assessments saved yet'}
            description={isFiltered ? 'Try a different search, class, section or status.' : 'Marks appear here as soon as you save them from Marks entry.'}
            action={
              isFiltered ? (
                <Button variant="outline" onClick={reset}>
                  Clear filters
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/teacher/marks">Start entering marks</Link>
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className={cn('hidden overflow-x-auto md:block', list.isFetching && 'opacity-70 transition-opacity')}>
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <SortHeader field="name" active={filters.sortBy} dir={filters.sortDir} onSort={onSort} className="sticky left-0 z-10 bg-card">
                      Student
                    </SortHeader>
                    <SortHeader field="classSection" active={filters.sortBy} dir={filters.sortDir} onSort={onSort}>
                      Class
                    </SortHeader>
                    {COMPONENTS.map((c) => (
                      <TableHead key={c.key} className="h-auto px-1.5 py-2 text-center leading-tight" title={`${c.label} (out of ${c.max})`}>
                        <span className="block">{c.group === 'textbook' ? 'Textbook' : `Ch ${c.group === 'chapter1' ? 1 : 2}`}</span>
                        <span className="block">{c.group === 'textbook' ? <>&nbsp;</> : c.short}</span>
                        <span className="block font-normal text-subtle">/{c.max}</span>
                      </TableHead>
                    ))}
                    <SortHeader field="totalMarks" active={filters.sortBy} dir={filters.sortDir} onSort={onSort} className="text-right">
                      Total
                    </SortHeader>
                    <SortHeader field="status" active={filters.sortBy} dir={filters.sortDir} onSort={onSort}>
                      Status
                    </SortHeader>
                    <SortHeader field="updatedAt" active={filters.sortBy} dir={filters.sortDir} onSort={onSort}>
                      Last saved
                    </SortHeader>
                    <th className="w-12 px-3" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.items.map((r) => (
                    <TableRow key={r.studentId} className="group">
                      <TableCell className="sticky left-0 z-10 min-w-[12rem] bg-card group-hover:bg-[#f3f5fd]">
                        <p className="font-semibold">{r.name}</p>
                        <p className="text-xs text-muted-foreground">ID {r.studentId}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{classLabel(r.classLevel, r.section)}</TableCell>
                      {COMPONENTS.map((c) => (
                        <TableCell key={c.key} className="px-1.5 text-center tabular-nums">
                          {r.marks[c.key] == null ? <span className="text-subtle">—</span> : formatMark(r.marks[c.key])}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-bold tabular-nums">{formatMark(r.totalMarks)}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">{r.updatedBy}</p>
                        <p>{timeAgo(r.updatedAt)}</p>
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="icon" className="size-8">
                          <Link to={entryLink(r)} aria-label={`Edit marks for ${r.name}`}>
                            <PencilLine />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className={cn('divide-y md:hidden', list.isFetching && 'opacity-70')}>
              {list.data.items.map((r) => (
                <li key={r.studentId} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ID {r.studentId} · {classLabel(r.classLevel, r.section)}
                      </p>
                    </div>
                    <p className="font-bold">
                      {formatMark(r.totalMarks)}
                      <span className="text-xs font-medium text-muted-foreground">/30</span>
                    </p>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                    {GROUPS.map((g) => (
                      <div key={g.key} className="rounded-lg bg-muted/60 p-2">
                        <dt className="font-semibold text-muted-foreground">{g.label}</dt>
                        <dd className="mt-0.5 font-bold">
                          {COMPONENTS.filter((c) => c.group === g.key)
                            .map((c) => formatMark(r.marks[c.key]))
                            .join(' · ')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={r.status} />
                    <p className="text-xs text-muted-foreground">
                      {firstName(r.updatedBy)} · {timeAgo(r.updatedAt)}
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link to={entryLink(r)} aria-label={`Edit marks for ${r.name}`}>
                        <PencilLine aria-hidden /> Edit
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {meta && <TablePager meta={meta} pageSize={filters.pageSize} onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
          </>
        )}
      </Card>
    </div>
  );
}
