import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MousePointerClick, PlayCircle } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { useBlocker, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useStudentFilters } from '@/hooks/useStudentFilters';
import { useStructure } from '@/hooks/useStructure';
import { studentsApi } from '@/services/api';
import { MarkSheet } from './MarkSheet';
import { StudentPicker } from './StudentPicker';

const DEFAULTS = { sortBy: 'classSection', sortDir: 'asc', pageSize: 100 } as const;

/**
 * The data-entry workspace: pick a student on the left, type the seven marks on the right, "Save & next".
 * Everything stays on one page. Class, section, status, search and sort live in the URL.
 */
export function MarksWorkspacePage() {
  const { filters, query, update, reset, isFiltered } = useStudentFilters(DEFAULTS);
  const [params, setParams] = useSearchParams();
  const selectedId = Number(params.get('student')) || undefined;
  const structure = useStructure();

  const list = useQuery({ queryKey: ['students', query], queryFn: () => studentsApi.list(query), placeholderData: keepPreviousData });
  const items = list.data?.items;

  // --- unsaved-changes protection -------------------------------------------------------------
  const dirty = useRef(false);
  const setDirty = useCallback((v: boolean) => {
    dirty.current = v;
  }, []);
  // Leaving the page, or switching to a different student while marks are unsaved, asks first.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!dirty.current) return false;
    if (currentLocation.pathname !== nextLocation.pathname) return true;
    const student = (loc: { search: string }) => new URLSearchParams(loc.search).get('student');
    return student(currentLocation) !== student(nextLocation);
  });
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const select = useCallback(
    (studentId?: number) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (studentId) next.set('student', String(studentId));
          else next.delete('student');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const index = items?.findIndex((s) => s.studentId === selectedId) ?? -1;
  const nextStudent = index >= 0 ? items?.[index + 1] : undefined;
  const goNext = useCallback(() => {
    if (nextStudent) select(nextStudent.studentId);
  }, [nextStudent, select]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marks entry"
        description="Pick a class and section, choose a student, type the seven marks. The total is worked out for you."
        className={cn(selectedId && 'max-lg:hidden')}
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)]">
        <div className={cn('lg:sticky lg:top-6', selectedId && 'max-lg:hidden')}>
          <StudentPicker
            items={items}
            meta={list.data?.meta}
            isPending={list.isPending}
            isFetching={list.isFetching}
            error={list.error}
            onRetry={() => list.refetch()}
            selectedId={selectedId}
            onSelect={select}
            filters={filters}
            update={update}
            reset={reset}
            isFiltered={isFiltered}
            structure={structure.data}
          />
        </div>

        <div className={cn('min-w-0', !selectedId && 'max-lg:hidden')}>
          {selectedId ? (
            <MarkSheet studentId={selectedId} onDirtyChange={setDirty} onNext={goNext} hasNext={!!nextStudent} onClose={() => select(undefined)} />
          ) : (
            <Card className="flex flex-col items-center gap-4 px-6 py-8 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <MousePointerClick className="size-7" aria-hidden />
              </span>
              <div className="max-w-sm space-y-1">
                <p className="text-lg font-bold">Choose a student to start</p>
                <p className="text-sm text-muted-foreground">Filter by class and section on the left, then select a name. After saving, “Save &amp; next” moves down the list.</p>
              </div>
              {items?.[0] && (
                <Button onClick={() => select(items[0].studentId)}>
                  <PlayCircle aria-hidden /> Start with {items[0].name}
                </Button>
              )}
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={blocker.state === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>The marks you typed for this student haven’t been saved yet. If you leave now they will be lost.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                dirty.current = false;
                blocker.proceed?.();
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
