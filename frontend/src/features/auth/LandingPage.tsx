import { ArrowRight, GraduationCap, PencilLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { RedPenMark } from '@/components/common/RedPenScore';
import { cn } from '@/lib/utils';
import { useSchool } from './LoginShell';

function Door({ to, icon: Icon, title, text, tone }: { to: string; icon: typeof PencilLine; title: string; text: string; tone: 'primary' | 'good' }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-card transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-pop sm:p-6"
    >
      <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl', tone === 'primary' ? 'bg-primary-soft text-primary' : 'bg-good-soft text-good')}>
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold">{title}</span>
        <span className="block text-sm text-muted-foreground">{text}</span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden />
    </Link>
  );
}

export function LandingPage() {
  const { data: school } = useSchool();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <section className="notebook relative flex flex-col justify-between gap-12 px-6 py-8 pl-[4.5rem] sm:px-10 sm:pl-[5.5rem] lg:px-16 lg:pl-28 lg:py-12">
        <Brand subtitle={school ? `${school.name} · ${school.shift} shift` : undefined} />
        <div className="max-w-xl space-y-6">
          <h1 className="text-4xl font-extrabold leading-[1.08] sm:text-5xl">
            Marks go in once,
            <br />
            and stay correct.
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground">
            Teachers enter each student’s assessment — seven parts, thirty marks, added up automatically. Students sign in to see their own result.
          </p>
          <RedPenMark size="lg" animate label="Assessments are marked out of 30">
            out of 30
          </RedPenMark>
        </div>
        <p className="text-xs text-muted-foreground">Only registered teachers and enrolled students can sign in.</p>
      </section>

      <main className="flex flex-col justify-center gap-4 bg-background px-6 py-12 sm:px-10 lg:px-14">
        <h2 className="text-xl font-bold">Who’s signing in?</h2>
        <Door to="/login/teacher" icon={PencilLine} tone="primary" title="I’m a teacher" text="Enter and review assessment marks" />
        <Door to="/login/student" icon={GraduationCap} tone="good" title="I’m a student" text="See my own assessment marks" />
      </main>
    </div>
  );
}
