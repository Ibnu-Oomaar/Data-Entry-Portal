import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, Save, SkipForward } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Avatar } from '@/components/common/Avatar';
import { RedPenScore } from '@/components/common/RedPenScore';
import { ErrorState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { COMPONENTS, GROUPS, MAX_TOTAL, computeTotals, formatMark, marksToFormValues, parseMark } from '@/lib/assessment';
import { classLabel, cn, timeAgo } from '@/lib/utils';
import { marksFormSchema, type MarksFormValues } from '@/schemas/marks';
import { assessmentsApi } from '@/services/api';
import { ApiError } from '@/services/api-client';
import type { ComponentKey, Marks, SaveResult, StudentAssessment } from '@/types/api';

interface Props {
  studentId: number;
  onDirtyChange: (dirty: boolean) => void;
  /** Called after "Save & next" succeeded. */
  onNext: () => void;
  hasNext: boolean;
  /** Close the sheet and return to the list. */
  onClose: () => void;
}

export function MarkSheet({ studentId, ...rest }: Props) {
  const query = useQuery({ queryKey: ['assessment', studentId], queryFn: () => assessmentsApi.get(studentId), refetchOnWindowFocus: false, gcTime: 0 });

  if (query.isPending) {
    return (
      <Card className="space-y-4 p-6" role="status" aria-label="Loading student">
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <Card>
        <ErrorState message={notFound ? `There is no student with ID ${studentId}.` : (query.error as Error).message} onRetry={notFound ? rest.onClose : () => query.refetch()} />
      </Card>
    );
  }
  return <MarkForm key={studentId} studentId={studentId} data={query.data} refetch={() => query.refetch()} {...rest} />;
}

function MarkForm({ studentId, data, refetch, onDirtyChange, onNext, hasNext, onClose }: Props & { data: StudentAssessment; refetch: () => Promise<unknown> }) {
  const qc = useQueryClient();
  const { student, assessment } = data;
  const [conflict, setConflict] = useState<string | null>(null);
  const [emptyError, setEmptyError] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const saved = useMemo(() => marksToFormValues(assessment?.marks), [assessment]);
  const form = useForm<MarksFormValues>({ resolver: zodResolver(marksFormSchema), defaultValues: saved, mode: 'onChange' });
  const { register, handleSubmit, watch, reset, setError, formState } = form;
  const values = watch();

  // What the teacher is typing right now, turned into numbers. Invalid text counts as "not entered".
  const live = useMemo(() => {
    const marks = {} as Marks;
    for (const c of COMPONENTS) {
      const r = parseMark(values[c.key] ?? '', c);
      marks[c.key] = r.ok ? r.value : null;
    }
    return { marks, totals: computeTotals(marks) };
  }, [values]);

  const dirty = formState.isDirty;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  // Focus the first mark on large screens so a teacher can start typing immediately (not on phones: it would pop the keyboard).
  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) inputs.current[0]?.focus();
  }, []);

  const save = useMutation({
    mutationFn: ({ marks }: { marks: Marks; next: boolean }) => assessmentsApi.save(studentId, { ...marks, expectedVersion: assessment?.version ?? null }),
    onSuccess: (res: SaveResult, { next }) => {
      onDirtyChange(false); // so moving on to the next student is not treated as discarding work
      qc.setQueryData<StudentAssessment>(['assessment', studentId], { student: res.student, assessment: res.assessment });
      reset(marksToFormValues(res.assessment?.marks));
      for (const key of ['students', 'assessments', 'stats', 'structure']) qc.invalidateQueries({ queryKey: [key] });
      setConflict(null);
      const a = res.assessment!;
      toast.success(res.unchanged ? `No changes — ${student.name} is already saved` : `Saved marks for ${student.name}`, {
        description: `${formatMark(a.totalMarks)} / ${MAX_TOTAL} · ${a.status === 'submitted' ? 'completed' : `${a.enteredCount} of 7 parts entered`}`,
      });
      if (next) {
        if (hasNext) onNext();
        else toast.info('That was the last student in this list');
      }
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'STALE_ASSESSMENT') {
        setConflict(err.message);
        return;
      }
      if (err instanceof ApiError && err.status === 422) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (COMPONENTS.some((c) => c.key === field)) setError(field as ComponentKey, { message });
        }
        if (err.code === 'NO_MARKS') setEmptyError(true);
      }
      toast.error('Marks were not saved', { description: err instanceof Error ? err.message : undefined });
    },
  });

  const submit = (next: boolean) =>
    handleSubmit((vals) => {
      if (save.isPending) return; // never send the same save twice
      const marks = {} as Marks;
      for (const c of COMPONENTS) {
        const r = parseMark(vals[c.key], c);
        marks[c.key] = r.ok ? r.value : null;
      }
      if (computeTotals(marks).entered === 0) {
        setEmptyError(true);
        inputs.current[0]?.focus();
        return;
      }
      setEmptyError(false);
      save.mutate({ marks, next });
    })();

  /** "Save & next" on a student whose marks are already saved just moves on. */
  const saveAndNext = () => {
    if (!dirty && assessment) {
      if (hasNext) onNext();
      else toast.info('That was the last student in this list');
      return;
    }
    void submit(true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (i < COMPONENTS.length - 1) {
        inputs.current[i + 1]?.focus();
        inputs.current[i + 1]?.select();
      } else saveAndNext();
    } else if (e.key === 'ArrowDown' && i < COMPONENTS.length - 1) {
      e.preventDefault();
      inputs.current[i + 1]?.focus();
    } else if (e.key === 'ArrowUp' && i > 0) {
      e.preventDefault();
      inputs.current[i - 1]?.focus();
    }
  };

  const cancel = () => {
    if (dirty) {
      reset(saved);
      setEmptyError(false);
      toast('Changes discarded', { description: 'The saved marks are back.' });
    } else onClose();
  };

  const reload = async () => {
    onDirtyChange(false);
    await refetch();
    setConflict(null);
    // The key on <MarkForm> stays the same, so reload by resetting to the freshly fetched values.
    const fresh = qc.getQueryData<StudentAssessment>(['assessment', studentId]);
    reset(marksToFormValues(fresh?.assessment?.marks));
    toast.success('Showing the latest saved marks');
  };

  const { totals } = live;
  const anyError = Object.keys(formState.errors).length > 0;
  const busy = save.isPending;

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(false); }} noValidate aria-label={`Marks for ${student.name}`} className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={onClose} aria-label="Back to student list">
          <ArrowLeft />
        </Button>
        <Avatar name={student.name} seed={student.studentId} className="size-12 text-sm" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold">{student.name}</h2>
          <p className="text-sm text-muted-foreground">
            ID {student.studentId} · {classLabel(student.classLevel, student.section)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={assessment?.status ?? 'pending'} />
          <p className="text-xs text-muted-foreground">
            {assessment ? `Saved by ${assessment.updatedBy} · ${timeAgo(assessment.updatedAt)}` : 'No marks saved yet'}
          </p>
        </div>
      </Card>

      {conflict && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-bar/50 bg-amber-soft p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="size-5 shrink-0 text-amber" aria-hidden />
          <p className="flex-1 text-sm font-medium text-amber">{conflict}</p>
          <Button type="button" variant="outline" size="sm" onClick={reload}>
            <RefreshCw aria-hidden /> Show latest marks
          </Button>
        </div>
      )}

      <Card className="divide-y overflow-hidden">
        {GROUPS.map((g) => {
          const subtotal = totals[g.key];
          const defs = COMPONENTS.filter((c) => c.group === g.key);
          return (
            <fieldset key={g.key} className="px-4 py-4 sm:px-6">
              <legend className="sr-only">{g.label}</legend>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h3 className="text-[15px] font-bold">{g.label}</h3>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  <span className="font-bold text-foreground">{formatMark(subtotal)}</span> / {g.max}
                  <span className="ml-2 text-xs">{formatMark(g.max - subtotal)} left</span>
                </p>
              </div>
              <div className="divide-y divide-dashed">
                {defs.map((c) => {
                  const i = COMPONENTS.findIndex((x) => x.key === c.key);
                  const err = formState.errors[c.key]?.message;
                  const { ref, ...reg } = register(c.key, { onChange: () => setEmptyError(false) });
                  return (
                    <div key={c.key} className="py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor={`mark-${c.key}`} className="min-w-0 text-sm font-semibold">
                          {c.short}
                          <span className="sr-only"> ({g.label})</span>
                          <span className="ml-2 text-xs font-normal text-muted-foreground">out of {c.max}</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <Input
                            id={`mark-${c.key}`}
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="–"
                            aria-label={c.label}
                            aria-invalid={!!err}
                            aria-describedby={err ? `err-${c.key}` : undefined}
                            disabled={busy}
                            className={cn('h-11 w-24 text-center text-lg font-bold', err && 'border-destructive')}
                            onKeyDown={(e) => onKeyDown(e, i)}
                            onFocus={(e) => e.currentTarget.select()}
                            ref={(el) => {
                              ref(el);
                              inputs.current[i] = el;
                            }}
                            {...reg}
                          />
                          <span className="w-9 text-sm text-muted-foreground">/ {c.max}</span>
                        </div>
                      </div>
                      {err && (
                        <p id={`err-${c.key}`} className="mt-1.5 text-right text-xs font-semibold text-destructive">
                          {err}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </Card>

      <Card className="sticky bottom-3 z-10 space-y-3 p-4 shadow-pop sm:p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex items-center gap-4">
            <RedPenScore value={totals.entered === 0 ? null : totals.total} size="md" />
            <div className="min-w-0 space-y-1.5 sm:w-32">
              <p className="text-sm font-semibold">{formatMark(totals.remaining)} marks remaining</p>
              <Progress value={(totals.total / MAX_TOTAL) * 100} aria-label="Marks entered out of 30" />
              <p className="text-xs text-muted-foreground">{totals.entered} of 7 parts entered</p>
            </div>
          </div>
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <Button type="button" variant="ghost" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" disabled={busy || anyError || (!dirty && !!assessment)}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" onClick={saveAndNext} disabled={busy || anyError} className="ml-auto sm:ml-0">
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <SkipForward aria-hidden />}
              Save &amp; next
            </Button>
          </div>
        </div>
        {emptyError && (
          <p role="alert" className="text-xs font-semibold text-destructive">
            Enter at least one mark before saving.
          </p>
        )}
        {!emptyError && totals.entered > 0 && !totals.complete && !anyError && (
          <p className="text-xs text-amber">Empty parts are saved as “not entered” — marked In progress.</p>
        )}
        {anyError && (
          <p role="alert" className="text-xs font-semibold text-destructive">
            Fix the highlighted marks to save.
          </p>
        )}
      </Card>
    </form>
  );
}
