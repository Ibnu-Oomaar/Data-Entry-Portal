import { BarChart3 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@/components/common/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Overview } from '@/types/api';

function Tip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Overview['distribution'][number] }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-pop">
      <p className="font-semibold">{d.label} marks</p>
      <p className="text-muted-foreground">
        {d.count} {d.count === 1 ? 'student' : 'students'}
      </p>
    </div>
  );
}

/** How many completed assessments fall in each 5-mark band. One hue, because it is one measure. */
export function ScoreDistribution({ distribution }: { distribution: Overview['distribution'] }) {
  const total = distribution.reduce((n, d) => n + d.count, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Score distribution</CardTitle>
        <CardDescription>Completed assessments by total marks out of 30</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState icon={BarChart3} className="py-10" title="No completed assessments yet" description="The chart appears as soon as the first student has all seven marks entered." />
        ) : (
          <>
            <div className="h-56 w-full" role="img" aria-label={`Score distribution: ${distribution.map((d) => `${d.label} marks: ${d.count}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap={10}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                  <ChartTooltip cursor={{ fill: 'var(--primary-soft)' }} content={<Tip />} />
                  <Bar dataKey="count" fill="var(--primary)" radius={[5, 5, 0, 0]} maxBarSize={44} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="sr-only">
              <caption>Score distribution</caption>
              <tbody>
                {distribution.map((d) => (
                  <tr key={d.label}>
                    <th scope="row">{d.label} marks</th>
                    <td>{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
