import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function KpiTile({ label, value, hint, icon: Icon, tone = 'neutral', children }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ComponentType<{ className?: string }>; tone?: 'neutral' | 'good' | 'amber' | 'primary'; children?: React.ReactNode }) {
  const tones = { neutral: 'bg-muted text-muted-foreground', good: 'bg-good-soft text-good', amber: 'bg-amber-soft text-amber', primary: 'bg-primary-soft text-primary' } as const;
  return (
    <Card className="flex flex-col gap-1 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn('flex size-7 items-center justify-center rounded-lg', tones[tone])}>
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <p className="text-[1.75rem] font-bold leading-tight">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </Card>
  );
}
