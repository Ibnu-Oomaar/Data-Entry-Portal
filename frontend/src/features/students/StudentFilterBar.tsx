import { ArrowDownAZ, ArrowUpAZ, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { StudentFilters } from '@/hooks/useStudentFilters';
import { cn } from '@/lib/utils';
import type { ClassSummary, ListStatus, StudentSortField } from '@/types/api';

export const SORT_LABELS: Record<StudentSortField, string> = {
  classSection: 'Class & section',
  studentId: 'Student ID',
  name: 'Name',
  classLevel: 'Class',
  section: 'Section',
  totalMarks: 'Total marks',
  status: 'Status',
  updatedAt: 'Last updated',
};

const STATUS_OPTIONS: Array<{ value: ListStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Not started' },
  { value: 'draft', label: 'In progress' },
  { value: 'submitted', label: 'Completed' },
];

function Chip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-input hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

const Count = ({ n, active }: { n: number; active: boolean }) => <span className={cn('text-xs font-medium', active ? 'text-white/80' : 'text-subtle')}>{n}</span>;

/**
 * Search + class tabs + section chips + status + sort. Used by the marks workspace, the student records
 * and the assessment records pages so "classify by class and section" works the same everywhere.
 */
export function StudentFilterBar({
  filters,
  update,
  reset,
  isFiltered,
  structure,
  sortFields,
  hideStatusPending,
  compact = false,
}: {
  filters: StudentFilters;
  update: (patch: Partial<StudentFilters>) => void;
  reset: () => void;
  isFiltered: boolean;
  structure: ClassSummary[] | undefined;
  sortFields: StudentSortField[];
  hideStatusPending?: boolean;
  compact?: boolean;
}) {
  // Typing is debounced so the list does not refetch on every keystroke.
  const [text, setText] = useState(filters.search);
  const debounced = useDebouncedValue(text, 250);
  useEffect(() => {
    if (debounced.trim() !== filters.search.trim()) update({ search: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  useEffect(() => setText(filters.search), [filters.search]);

  const classes = structure ?? [];
  const sections = useMemo(() => {
    if (filters.classLevel) return classes.find((c) => c.classLevel === filters.classLevel)?.sections.map((s) => ({ section: s.section, students: s.students })) ?? [];
    const map = new Map<string, number>();
    for (const c of classes) for (const s of c.sections) map.set(s.section, (map.get(s.section) ?? 0) + s.students);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([section, students]) => ({ section, students }));
  }, [classes, filters.classLevel]);
  const total = classes.reduce((n, c) => n + c.students, 0);

  const chooseClass = (classLevel?: number) => {
    const stillValid = !filters.section || !classLevel || classes.find((c) => c.classLevel === classLevel)?.sections.some((s) => s.section === filters.section);
    update({ classLevel, ...(stillValid ? {} : { section: undefined }) });
  };

  return (
    <div className={cn('space-y-3', compact && 'space-y-2.5')}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search name or Student ID"
          aria-label="Search students by name or Student ID"
          className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button type="button" aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-subtle hover:bg-muted" onClick={() => setText('')}>
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by class">
        <Chip active={!filters.classLevel} onClick={() => chooseClass(undefined)}>
          All classes <Count n={total} active={!filters.classLevel} />
        </Chip>
        {classes.map((c) => (
          <Chip key={c.classLevel} active={filters.classLevel === c.classLevel} onClick={() => chooseClass(c.classLevel)}>
            Class {c.classLevel} <Count n={c.students} active={filters.classLevel === c.classLevel} />
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by section">
        <Chip active={!filters.section} onClick={() => update({ section: undefined })}>
          All sections
        </Chip>
        {sections.map((s) => (
          <Chip key={s.section} active={filters.section === s.section} onClick={() => update({ section: s.section })} className="min-w-11 justify-center">
            {s.section} <Count n={s.students} active={filters.section === s.section} />
          </Chip>
        ))}
      </div>

      <div className={cn('grid gap-2', compact ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]' : 'sm:grid-cols-[1fr_1fr_auto_auto]')}>
        <Select value={filters.status ?? 'all'} onValueChange={(v) => update({ status: v === 'all' ? undefined : (v as ListStatus) })}>
          <SelectTrigger aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.filter((o) => !(hideStatusPending && o.value === 'pending')).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className={cn('flex min-w-0 gap-2', compact && 'contents')}>
          <Select value={filters.sortBy} onValueChange={(v) => update({ sortBy: v as StudentSortField })}>
            <SelectTrigger aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortFields.map((f) => (
                <SelectItem key={f} value={f}>
                  Sort: {SORT_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            aria-label={filters.sortDir === 'asc' ? 'Ascending — switch to descending' : 'Descending — switch to ascending'}
            title={filters.sortDir === 'asc' ? 'Ascending' : 'Descending'}
            onClick={() => update({ sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' })}
          >
            {filters.sortDir === 'asc' ? <ArrowDownAZ /> : <ArrowUpAZ />}
          </Button>
        </div>
        {isFiltered && (
          <Button variant="ghost" onClick={reset} className={cn(compact && 'col-span-3')}>
            <X aria-hidden /> Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
