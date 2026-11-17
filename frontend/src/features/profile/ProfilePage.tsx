import { useQuery } from '@tanstack/react-query';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatMark } from '@/lib/assessment';
import { classLabel, formatDateTime, timeAgo } from '@/lib/utils';
import { statsApi } from '@/services/api';
import { TeacherPasskeySetup } from './TeacherPasskeySetup';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold">{children}</dd>
    </div>
  );
}

function TeacherActivity() {
  const q = useQuery({ queryKey: ['stats', 'me'], queryFn: statsApi.me });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your data entry</CardTitle>
        <CardDescription>What you have entered in this portal</CardDescription>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-28" />
        ) : q.isError ? (
          <p className="text-sm text-destructive">{(q.error as Error).message}</p>
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-primary-soft p-4">
                <dt className="text-xs font-medium text-muted-foreground">First entered by you</dt>
                <dd className="text-2xl font-bold">{q.data.assessmentsCreated}</dd>
              </div>
              <div className="rounded-xl bg-primary-soft p-4">
                <dt className="text-xs font-medium text-muted-foreground">Last edited by you</dt>
                <dd className="text-2xl font-bold">{q.data.assessmentsLastEditedByMe}</dd>
              </div>
              <div className="rounded-xl bg-primary-soft p-4">
                <dt className="text-xs font-medium text-muted-foreground">Last activity</dt>
                <dd className="text-sm font-bold">{q.data.lastActivityAt ? timeAgo(q.data.lastActivityAt) : '—'}</dd>
              </div>
            </dl>
            {q.data.recent.length === 0 ? (
              <EmptyState className="py-8" title="Nothing entered yet" description="Marks you save will be listed here." action={<Button asChild size="sm"><Link to="/teacher/marks">Enter marks</Link></Button>} />
            ) : (
              <ul className="mt-4 divide-y">
                {q.data.recent.map((r) => (
                  <li key={`${r.studentId}-${r.at}`}>
                    <Link to={`/teacher/marks?student=${r.studentId}&class=${r.classLevel}&section=${r.section}`} className="flex items-center justify-between gap-3 rounded-lg py-3 hover:bg-primary-soft/50 sm:px-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{r.studentName}</span>
                        <span className="block text-xs text-muted-foreground">
                          {classLabel(r.classLevel, r.section)} · {timeAgo(r.at)}
                        </span>
                      </span>
                      <span className="text-sm font-bold">{formatMark(r.totalMarks)}<span className="text-xs font-medium text-muted-foreground">/30</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Profile and account page for both roles. */
export function ProfilePage() {
  const { session, logout } = useAuth();
  if (!session) return null;
  const signOut = () => void logout();
  const isTeacher = session.role === 'teacher';
  const name = isTeacher ? session.user.fullName : session.user.name;

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Profile and account" description="Who is signed in on this device" />

      <Card>
        <CardContent className="space-y-1 pt-6">
          <div className="flex items-center gap-4 pb-4">
            <Avatar name={name} seed={isTeacher ? 1 : session.user.studentId} className="size-14 text-base" />
            <div className="min-w-0">
              <p className="truncate text-xl font-bold">{name}</p>
              <p className="text-sm text-muted-foreground">{isTeacher ? 'Teacher' : 'Student'}</p>
            </div>
          </div>
          <dl className="divide-y border-t">
            {session.role === 'student' && (
              <>
                <Field label="Student ID">{session.user.studentId}</Field>
                <Field label="Class">{session.user.classLevel}</Field>
                <Field label="Section">{session.user.section}</Field>
              </>
            )}
            <Field label="School">{session.school.name}</Field>
            <Field label="Shift">{session.school.shift}</Field>
            <Field label="Signed in until">{session.expiresAt ? formatDateTime(session.expiresAt) : '—'}</Field>
          </dl>
        </CardContent>
      </Card>

      {isTeacher && <TeacherActivity />}
      {isTeacher && <TeacherPasskeySetup />}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center">
          <ShieldCheck className="size-6 shrink-0 text-primary" aria-hidden />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Keep your account safe</p>
            <p className="text-muted-foreground">
              {isTeacher
                ? 'Sign in with a passkey or your account password. Sign out when you use a shared computer.'
                : 'Sign-in uses your Student ID only. Don’t share it — anyone who knows it can see your marks. Sign out on shared devices.'}
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut aria-hidden /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
