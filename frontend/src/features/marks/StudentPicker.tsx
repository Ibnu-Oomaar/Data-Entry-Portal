import { ChevronLeft, ChevronRight, SearchX, Users } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatMark } from '@/lib/assessment';
import { classLabel, cn } from '@/lib/utils';
import type { PageMeta, StudentListItem } from '@/types/api';
import type { StudentFilters } from '@/hooks/useStudentFilters';
import { StudentFilterBar } from '@/features/students/StudentFilterBar';
import type { ClassSummary } from '@/types/api';

const DOT = { submitted: 'bg-good-bar', draft: 'bg-amber-bar', pending: 'bg-track ring-1 ring-inset ring-input' } as const;

export function StudentPicker({
  items,
  meta,
  isPending,
  isFetching,
  error,
  onRetry,
  selectedId,
  onSelect,
  filters,
  update,
  reset,
  isFiltered,
  structure,
}: {
  items: StudentListItem[] | undefined;
  meta: PageMeta | undefined;
  isPending: boolean;
  isFetching: boolean;
  error: Error | null;
  onRetry: () => void;
  selectedId?: number;
  onSelect: (studentId: number) => void;
  filters: StudentFilters;
  update: (patch: Partial<StudentFilters>) => void;
  reset: () => void;
  isFiltered: boolean;
  structure: ClassSummary[] | undefined;
}) {
  const from = meta && meta.total ? (meta.page - 1) * meta.pageSize + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.pageSize, meta.total) : 0;

  return (
    <Card className="flex flex-col overflow-hidden lg:h-[calc(100dvh-4.5rem)]">
      <div className="space-y-3 border-b p-4">
        <StudentFilterBar
          compact
          filters={filters}
          update={update}
          reset={reset}
          isFiltered={isFiltered}
          structure={structure}
          sortFields={['classSection', 'name', 'studentId', 'totalMarks', 'status']}
        />
      </div>

      <div className={cn('scroll-soft min-h-0 flex-1 overflow-y-auto transition-opacity', isFetching && !isPending && 'opacity-70')}>
        {error ? (
          <ErrorState message={error.message} onRetry={onRetry} />
        ) : isPending ? (
          <RowsSkeleton rows={8} />
        ) : items && items.length === 0 ? (
          isFiltered ? (
            <EmptyState
              icon={SearchX}
              title="No students match"
              description="Try a different search, class, section or status."
              action={
                <Button variant="outline" size="sm" onClick={reset}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Users} title="No students yet" description="Import the school workbook to add students." />
          )
        ) : (
          <ul aria-label="Students" className="divide-y">
            {items?.map((s) => {
              const selected = s.studentId === selectedId;
              return (
                <li key={s.studentId}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.studentId)}
                    aria-current={selected ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary-soft/60',
                      selected && 'bg-primary-soft shadow-[inset_3px_0_0_var(--primary)]',
                    )}
                  >
                    <Avatar name={s.name} seed={s.studentId} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{s.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.studentId} · {classLabel(s.classLevel, s.section)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2" title={s.status === 'submitted' ? 'Completed' : s.status === 'draft' ? 'In progress' : 'Not started'}>
                      <span className={cn('size-2.5 rounded-full', DOT[s.status])} aria-hidden />
                      <span className="w-12 text-right text-sm font-bold">
                        {s.totalMarks == null ? <span className="font-normal text-subtle">—</span> : formatMark(s.totalMarks)}
                      </span>
                      <span className="sr-only">
                        <StatusBadge status={s.status} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {meta && meta.total > 0 && (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
          <p aria-live="polite">
            {from}–{to} of {meta.total}
          </p>
          {meta.totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-8" aria-label="Previous page" disabled={meta.page <= 1} onClick={() => update({ page: meta.page - 1 })}>
                <ChevronLeft />
              </Button>
              <span>
                Page {meta.page} / {meta.totalPages}
              </span>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Next page" disabled={meta.page >= meta.totalPages} onClick={() => update({ page: meta.page + 1 })}>
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
