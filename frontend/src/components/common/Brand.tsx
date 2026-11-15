import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('flex size-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm', className)}>
      <Check className="size-5" strokeWidth={3} />
    </span>
  );
}

export function Brand({ subtitle, className }: { subtitle?: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <BrandMark />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[15px] font-bold">Classes Data Entry</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
