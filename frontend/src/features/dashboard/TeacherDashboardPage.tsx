import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Clock3, PartyPopper, PencilLine, Percent, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { ErrorState } from '@/components/common/states';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useTeacher } from '@/features/auth/AuthProvider';
import { formatMark } from '@/lib/assessment';
import { classLabel, firstName, greeting } from '@/lib/utils';
import { statsApi, studentsApi } from '@/services/api';
import { ClassSectionProgress } from './ClassSectionProgress';
import { KpiTile } from './KpiTile';
import { RecentActivity } from './RecentActivity';
import { ScoreDistribution } from './ScoreDistribution';

/** "Continue where you left off": the first student, in class/section order, with nothing entered yet. */
function ContinueCard({ pending }: { pending: number }) {
  const next = useQuery({ queryKey: ['students', 'next-pending'], queryFn: () => studentsApi.list({ status: 'pending', pageSize: 1 }) });
  const s = next.data?.items[0];

  if (next.isPending) return <Skeleton className="h-28 w-full rounded-2xl" />;
  if (!s) {
    return (
      <Card className="flex items-center gap-4 border-good-bar/40 bg-good-soft p-5 shadow-none sm:p-6">
        <PartyPopper className="size-8 shrink-0 text-good" aria-hidden />
        <div className="flex-1">
          <p className="font-bold text-good">Every student has marks entered</p>
          <p className="text-sm text-good/80">{pending > 0 ? `${pending} assessment${pending === 1 ? ' is' : 's are'} still in progress.` : 'There is nothing left to enter.'}</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/teacher/assessments">Review records</Link>
        </Button>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-4 bg-primary p-5 text-primary-foreground shadow-pop sm:flex-row sm:items-center sm:p-6">
      <Avatar name={s.name} seed={s.studentId} className="size-12 bg-white/15 text-white" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white/75">Next student without marks</p>
        <p className="truncate text-lg font-bold">{s.name}</p>
        <p className="text-sm text-white/75">
          {classLabel(s.classLevel, s.section)} · ID {s.studentId}
        </p>
      </div>
      <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
        <Link to={`/teacher/marks?student=${s.studentId}&class=${s.classLevel}&section=${s.section}`}>
          <PencilLine aria-hidden /> Enter marks <ArrowRight aria-hidden />
        </Link>
      </Button>
    </Card>
  );
}

export function TeacherDashboardPage() {
  const teacher = useTeacher();
  const { data, isPending, isError, error, refetch } = useQuery({ queryKey: ['stats', 'overview'], queryFn: statsApi.overview, refetchInterval: 60_000 });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${firstName(teacher.user.fullName)}`}
        description={`${teacher.school.name} · ${teacher.school.shift} shift`}
        actions={
          <Button asChild>
            <Link to="/teacher/marks">
              <PencilLine aria-hidden /> Open marks entry
            </Link>
          </Button>
        }
      />

      {isError ? (
        <Card>
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        </Card>
      ) : isPending ? (
        <div className="space-y-6" role="status" aria-label="Loading dashboard">
          <Skeleton className="h-28 rounded-2xl" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <>
          <ContinueCard pending={data.totals.pending} />

          <section aria-label="Assessment statistics" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <KpiTile label="Registered students" value={data.totals.students} icon={Users} tone="primary" hint={`${data.classes.length} classes · ${data.classes.reduce((n, c) => n + c.sections.length, 0)} sections`} />
            <KpiTile label="Completed" value={data.totals.completed} icon={CheckCircle2} tone="good" hint="All seven marks entered" />
            <KpiTile label="Pending" value={data.totals.pending} icon={Clock3} tone="amber" hint={`${data.totals.inProgress} in progress · ${data.totals.notStarted} not started`} />
            <KpiTile label="Completion" value={`${data.totals.completionPercent}%`} icon={Percent} tone="primary">
              <Progress value={data.totals.completionPercent} className="mt-2 h-2" indicatorClassName="bg-good-bar" aria-label="Completion" />
            </KpiTile>
            <KpiTile
              label="Average mark"
              icon={TrendingUp}
              value={
                data.totals.average == null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <>
                    {formatMark(data.totals.average)}
                    <span className="text-sm font-medium text-muted-foreground"> / 30</span>
                  </>
                )
              }
              hint={data.totals.highest == null ? 'Shown once an assessment is completed' : `Lowest ${formatMark(data.totals.lowest)} · highest ${formatMark(data.totals.highest)}`}
            />
          </section>

          <ClassSectionProgress classes={data.classes} />

          <div className="grid gap-6 lg:grid-cols-2">
            <ScoreDistribution distribution={data.distribution} />
            <RecentActivity items={data.recentActivity} />
          </div>
        </>
      )}
    </div>
  );
}
