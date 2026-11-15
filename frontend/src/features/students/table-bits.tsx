import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { PageMeta, StudentSortField } from '@/types/api';

/** Clickable column header. Sorting is done by the server, so this only reports what the user asked for. */
export function SortHeader({
  field,
  active,
  dir,
  onSort,
  children,
  className,
}: {
  field: StudentSortField;
  active: StudentSortField;
  dir: 'asc' | 'desc';
  onSort: (field: StudentSortField) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const isActive = active === field;
  const Icon = !isActive ? ChevronsUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className} aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn('-ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground', isActive && 'text-foreground')}
      >
        {children}
        <Icon className={cn('size-3.5', !isActive && 'text-subtle')} aria-hidden />
      </button>
    </TableHead>
  );
}

export function TablePager({ meta, onPage, onPageSize, pageSize }: { meta: PageMeta; onPage: (p: number) => void; onPageSize: (n: number) => void; pageSize: number }) {
  const from = meta.total ? (meta.page - 1) * meta.pageSize + 1 : 0;
  const to = Math.min(meta.page * meta.pageSize, meta.total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
      <p aria-live="polite">
        Showing <span className="font-semibold text-foreground">{from}–{to}</span> of <span className="font-semibold text-foreground">{meta.total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
          <SelectTrigger aria-label="Rows per page" className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[25, 50, 100, 200].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} per page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="size-9" aria-label="Previous page" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          <ChevronLeft />
        </Button>
        <span className="min-w-20 text-center">
          Page {meta.page} of {meta.totalPages}
        </span>
        <Button variant="outline" size="icon" className="size-9" aria-label="Next page" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
