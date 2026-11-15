import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, Info, NotebookPen } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { RedPenScore } from '@/components/common/RedPenScore';
import { EmptyState, ErrorState } from '@/components/common/states';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudentSession } from '@/features/auth/AuthProvider';
import { COMPONENTS, GROUPS, formatMark } from '@/lib/assessment';
import { classLabel, formatDateTime } from '@/lib/utils';
import { assessmentsApi } from '@/services/api';
import type { AssessmentView } from '@/types/api';

function GroupCard({ groupKey, a }: { groupKey: 'chapter1' | 'chapter2' | 'textbook'; a: AssessmentView }) {
  const group = GROUPS.find((g) => g.key === groupKey)!;
  const subtotal = a.subtotals[groupKey];
  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between gap-3">
        <CardTitle className="text-lg">{group.label}</CardTitle>
        <p className="text-sm text-muted-foreground">
          <span className="text-xl font-bold text-foreground">{formatMark(subtotal)}</span> / {group.max}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {COMPONENTS.filter((c) => c.group === groupKey).map((c) => {
          const value = a.marks[c.key];
          return (
            <div key={c.key} className="space-y-1.5">
              {/* Textbook is a single part: its mark is already the card's headline, so don't repeat it. */}
              {(c.group !== 'textbook' || value == null) && (
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <p className="font-semibold">{c.group === 'textbook' ? 'Textbook' : c.short}</p>
                  <p aria-label={value == null ? 'Not marked yet' : `${formatMark(value)} out of ${c.max}`}>
                    {value == null ? (
                      <span className="text-muted-foreground">Not marked yet</span>
                    ) : (
                      <>
                        <span className="font-bold">{formatMark(value)}</span>
                        <span className="text-muted-foreground"> / {c.max}</span>
                      </>
                    )}
                  </p>
                </div>
              )}
              <Progress value={value == null ? 0 : (value / c.max) * 100} className="h-1.5" aria-label={`${c.label}: ${value == null ? 'not marked yet' : `${formatMark(value)} out of ${c.max}`}`} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** A student's own result. Read-only: there is no way to edit anything from here (the API enforces it too). */
export function StudentDashboardPage() {
  const me = useStudentSession();
  const q = useQuery({ queryKey: ['me', 'assessment'], queryFn: assessmentsApi.own });
  const { student: s } = { student: me.user };
  const a = q.data?.assessment ?? null;

  return (
    <div className="space-y-5">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <Avatar name={s.name} seed={s.studentId} className="size-14 text-base" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight">{s.name}</h1>
          <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <div className="flex gap-1.5">
              <dt>Student ID</dt>
              <dd className="font-semibold text-foreground">{s.studentId}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Class</dt>
              <dd className="font-semibold text-foreground">{s.classLevel}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Section</dt>
              <dd className="font-semibold text-foreground">{s.section}</dd>
            </div>
          </dl>
        </div>
        {q.data && <StatusBadge status={a?.status ?? 'pending'} />}
      </Card>

      {q.isError ? (
        <Card>
          <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
        </Card>
      ) : q.isPending ? (
        <div className="space-y-4" role="status" aria-label="Loading your marks">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : !a ? (
        <Card>
          <EmptyState
            icon={NotebookPen}
            title="Your marks haven’t been entered yet"
            description={`Your teacher will enter your assessment for ${classLabel(s.classLevel, s.section)}. Check back later — nothing is wrong with your account.`}
          />
        </Card>
      ) : (
        <>
          <Card className="flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:p-8 sm:text-left">
            <RedPenScore value={a.totalMarks} size="lg" animate />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h2 className="text-xl font-bold">Assessment total</h2>
                <p className="text-sm text-muted-foreground">
                  {a.status === 'submitted' ? 'All seven parts are marked.' : `${a.enteredCount} of 7 parts are marked so far.`}
                </p>
              </div>
              <Progress value={(a.totalMarks / a.maxTotal) * 100} className="h-2.5" indicatorClassName="bg-good-bar" aria-label="Total marks out of 30" />
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:justify-start">
                <span>Chapter 1: {formatMark(a.subtotals.chapter1)} / 13</span>
                <span>Chapter 2: {formatMark(a.subtotals.chapter2)} / 13</span>
                <span>Textbook: {formatMark(a.subtotals.textbook)} / 4</span>
              </div>
            </div>
          </Card>

          {a.status === 'draft' && (
            <div role="note" className="flex items-start gap-3 rounded-2xl bg-amber-soft p-4 text-sm text-amber">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>Some parts have not been marked yet, so your total may change when your teacher finishes entering them.</p>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <GroupCard groupKey="chapter1" a={a} />
            <GroupCard groupKey="chapter2" a={a} />
          </div>
          <GroupCard groupKey="textbook" a={a} />

          <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <BookOpenCheck className="size-4" aria-hidden /> Last updated {formatDateTime(a.updatedAt)}
          </p>
        </>
      )}
    </div>
  );
}
