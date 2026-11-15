import { History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { EmptyState } from '@/components/common/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMark } from '@/lib/assessment';
import { classLabel, firstName, timeAgo } from '@/lib/utils';
import type { ActivityItem } from '@/types/api';

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent data entry</CardTitle>
        <CardDescription>The latest marks saved by any teacher</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {items.length === 0 ? (
          <EmptyState icon={History} className="py-10" title="No marks entered yet" description="Saved assessments will appear here with who entered them." />
        ) : (
          <ul className="divide-y">
            {items.map((a) => (
              <li key={`${a.studentId}-${a.at}`}>
                <Link to={`/teacher/marks?student=${a.studentId}&class=${a.classLevel}&section=${a.section}`} className="flex items-center gap-3 rounded-lg py-3 hover:bg-primary-soft/50 sm:px-2">
                  <Avatar name={a.studentName} seed={a.studentId} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.studentName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {classLabel(a.classLevel, a.section)} · {a.action === 'created' ? 'entered' : 'updated'} by {firstName(a.teacher)} · {timeAgo(a.at)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold">
                    {formatMark(a.totalMarks)}
                    <span className="text-xs font-medium text-muted-foreground">/30</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
