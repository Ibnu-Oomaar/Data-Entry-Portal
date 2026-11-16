import { useQuery } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { PencilLine, SearchX, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { PageHeader } from '@/components/common/PageHeader';
import { ExcelExportButton } from '@/components/common/ExcelExportButton';
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { formatMark } from '@/lib/assessment';
import { classLabel, cn } from '@/lib/utils';
import { useStudentFilters } from '@/hooks/useStudentFilters';
import { useStructure } from '@/hooks/useStructure';
import { studentsApi } from '@/services/api';
import type { StudentListItem, StudentSortField } from '@/types/api';
import { StudentFilterBar } from './StudentFilterBar';
import { SortHeader, TablePager } from './table-bits';

const DEFAULTS = { sortBy: 'classSection', sortDir: 'asc', pageSize: 50 } as const;
const SORT_FIELDS: StudentSortField[] = ['classSection', 'studentId', 'name', 'classLevel', 'section', 'totalMarks', 'status'];

const entryLink = (s: StudentListItem) => `/teacher/marks?student=${s.studentId}&class=${s.classLevel}&section=${s.section}`;

export function StudentRecordsPage() {
  const { filters, query, update, reset, isFiltered } = useStudentFilters(DEFAULTS);
  const structure = useStructure();
  const list = useQuery({ queryKey: ['students', query], queryFn: () => studentsApi.list(query) });

  // Server-side sorting: react-table only renders; clicking a header asks the API for a new order.
  const sorting: SortingState = filters.sortBy === 'classSection' ? [] : [{ id: filters.sortBy, desc: filters.sortDir === 'desc' }];
  const onSort = (field: StudentSortField) => {
    const sameField = filters.sortBy === field;
    update({ sortBy: field, sortDir: sameField && filters.sortDir === 'asc' ? 'desc' : 'asc' });
  };

  const columns = useMemo<ColumnDef<StudentListItem>[]>(
    () => [
      { id: 'studentId', accessorKey: 'studentId', header: 'Student ID' },
      { id: 'name', accessorKey: 'name', header: 'Name' },
      { id: 'classLevel', accessorKey: 'classLevel', header: 'Class' },
      { id: 'section', accessorKey: 'section', header: 'Section' },
      { id: 'totalMarks', accessorKey: 'totalMarks', header: 'Total' },
      { id: 'status', accessorKey: 'status', header: 'Status' },
      { id: 'action', header: () => <span className="sr-only">Action</span> },
    ],
    [],
  );
  const table = useReactTable({
    data: list.data?.items ?? [],
    columns,
    state: { sorting },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    getRowId: (r) => String(r.studentId),
  });

  const meta = list.data?.meta;
  const summary = [filters.classLevel && `Class ${filters.classLevel}`, filters.section && `Section ${filters.section}`].filter(Boolean).join(' · ');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Students"
        description={meta ? `${meta.total} ${meta.total === 1 ? 'student' : 'students'}${summary ? ` · ${summary}` : ' registered'}` : 'Loading…'}
        actions={
          <>
            <ExcelExportButton download={() => studentsApi.export(query)} filename="student-records.xlsx" />
            <Button asChild>
              <Link to={`/teacher/marks${filters.classLevel ? `?class=${filters.classLevel}${filters.section ? `&section=${filters.section}` : ''}` : ''}`}>
                <PencilLine aria-hidden /> Enter marks
              </Link>
            </Button>
          </>
        }
      />

      <Card className="p-4 sm:p-5">
        <StudentFilterBar filters={filters} update={update} reset={reset} isFiltered={isFiltered} structure={structure.data} sortFields={SORT_FIELDS} />
      </Card>

      <Card className="overflow-hidden">
        {list.isError ? (
          <ErrorState message={(list.error as Error).message} onRetry={() => list.refetch()} />
        ) : list.isPending ? (
          <RowsSkeleton rows={10} />
        ) : list.data.items.length === 0 ? (
          <EmptyState
            icon={isFiltered ? SearchX : Users}
            title={isFiltered ? 'No students match these filters' : 'No students yet'}
            description={isFiltered ? 'Try a different search, class, section or status.' : 'Import the school workbook to add students.'}
            action={isFiltered ? <Button variant="outline" onClick={reset}>Clear filters</Button> : undefined}
          />
        ) : (
          <>
            {/* Desktop / tablet: table */}
            <div className={cn('hidden overflow-x-auto md:block', list.isFetching && 'opacity-70 transition-opacity')}>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id} className="hover:bg-transparent">
                      {hg.headers.map((h) =>
                        h.id === 'action' ? (
                          <th key={h.id} className="w-36 px-3" />
                        ) : (
                          <SortHeader key={h.id} field={h.id as StudentSortField} active={filters.sortBy} dir={filters.sortDir} onSort={onSort} className={h.id === 'totalMarks' ? 'text-right' : undefined}>
                            {flexRender(h.column.columnDef.header, h.getContext())}
                          </SortHeader>
                        ),
                      )}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => {
                    const s = row.original;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium tabular-nums text-muted-foreground">{s.studentId}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar name={s.name} seed={s.studentId} />
                            <span className="font-semibold">{s.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>Class {s.classLevel}</TableCell>
                        <TableCell>
                          <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary-soft text-[13px] font-bold text-secondary-foreground">{s.section}</span>
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums">
                          {s.totalMarks == null ? <span className="font-normal text-subtle">—</span> : <>{formatMark(s.totalMarks)}<span className="text-xs font-medium text-muted-foreground"> / 30</span></>}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={s.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant={s.status === 'pending' ? 'default' : 'outline'}>
                            <Link to={entryLink(s)} aria-label={`${s.status === 'pending' ? 'Enter' : 'Edit'} marks for ${s.name}`}>
                              <PencilLine aria-hidden /> {s.status === 'pending' ? 'Enter marks' : 'Edit marks'}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Phones: one card per student */}
            <ul className={cn('divide-y md:hidden', list.isFetching && 'opacity-70')}>
              {list.data.items.map((s) => (
                <li key={s.studentId} className="space-y-3 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} seed={s.studentId} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ID {s.studentId} · {classLabel(s.classLevel, s.section)}
                      </p>
                    </div>
                    <p className="text-right font-bold">
                      {s.totalMarks == null ? <span className="font-normal text-subtle">—</span> : <>{formatMark(s.totalMarks)}<span className="text-xs font-medium text-muted-foreground">/30</span></>}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={s.status} />
                    <Button asChild size="sm" variant={s.status === 'pending' ? 'default' : 'outline'}>
                      <Link to={entryLink(s)} aria-label={`${s.status === 'pending' ? 'Enter' : 'Edit'} marks for ${s.name}`}>
                        <PencilLine aria-hidden /> {s.status === 'pending' ? 'Enter marks' : 'Edit marks'}
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
