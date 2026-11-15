import { ArrowUpRight, PencilLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatMark } from '@/lib/assessment';
import type { Overview } from '@/types/api';

type Seg = { n: number; className: string };

/** One stacked bar: completed / in progress / not started, with a 2px gap between segments. */
function StackedBar({ completed, inProgress, notStarted, label }: { completed: number; inProgress: number; notStarted: number; label: string }) {
  const segs: Seg[] = [
    { n: completed, className: 'bg-good-bar' },
    { n: inProgress, className: 'bg-amber-bar' },
    { n: notStarted, className: 'bg-track' },
  ];
  const total = completed + inProgress + notStarted || 1;
  return (
    <div role="img" aria-label={label} className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
      {segs
        .filter((s) => s.n > 0)
        .map((s, i) => (
          <div key={i} className={`${s.className} first:rounded-l-full last:rounded-r-full`} style={{ width: `${(s.n / total) * 100}%` }} />
        ))}
    </div>
  );
}

export function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-good-bar" /> Completed
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-amber-bar" /> In progress
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full bg-track ring-1 ring-inset ring-input" /> Not started
      </li>
    </ul>
  );
}

/** Every class and section from the workbook, with real completion counts. Rows link to the filtered lists. */
export function ClassSectionProgress({ classes }: { classes: Overview['classes'] }) {
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Classes and sections</CardTitle>
          <CardDescription>Select a section to see its students or start entering marks.</CardDescription>
        </div>
        <Legend />
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        {classes.map((c) => (
          <section key={c.classLevel} aria-label={`Class ${c.classLevel}`} className="space-y-3">
            <div className="flex items-baseline justify-between gap-2 border-b pb-2">
              <h3 className="text-[15px] font-bold">Class {c.classLevel}</h3>
              <p className="text-xs text-muted-foreground">
                {c.completed} of {c.students} complete · {c.completionPercent}%
              </p>
            </div>
            <ul className="space-y-1">
              {c.sections.map((s) => {
                const label = `Class ${c.classLevel}${s.section}: ${s.completed} completed, ${s.inProgress} in progress, ${s.notStarted} not started`;
                return (
                  <li key={s.section} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-primary-soft/60">
                    <Link to={`/teacher/students?class=${c.classLevel}&section=${s.section}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg" aria-label={`${label}. View students`}>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-sm font-bold text-secondary-foreground">{s.section}</span>
                      <span className="min-w-0 flex-1 space-y-1.5">
                        <span className="flex items-baseline justify-between gap-2 text-[13px]">
                          <span className="font-semibold">
                            {s.completed}/{s.students} <span className="font-normal text-muted-foreground">done</span>
                          </span>
                          <span className="text-xs text-muted-foreground">{s.average == null ? 'No average yet' : `avg ${formatMark(s.average)}/30`}</span>
                        </span>
                        <StackedBar completed={s.completed} inProgress={s.inProgress} notStarted={s.notStarted} label={label} />
                      </span>
                      <ArrowUpRight className="size-4 shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" aria-hidden />
                    </Link>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          to={`/teacher/marks?class=${c.classLevel}&section=${s.section}`}
                          aria-label={`Enter marks for Class ${c.classLevel}${s.section}`}
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-subtle hover:bg-primary hover:text-white"
                        >
                          <PencilLine className="size-4" aria-hidden />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        Enter marks · {s.notStarted + s.inProgress} still to finish
                      </TooltipContent>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
