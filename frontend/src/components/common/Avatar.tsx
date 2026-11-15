import { cn, initials } from '@/lib/utils';

const TINTS = ['bg-primary-soft text-secondary-foreground', 'bg-good-soft text-good', 'bg-amber-soft text-amber', 'bg-pen-soft text-destructive', 'bg-muted text-muted-foreground'];

/** Soft initials badge. The tint is derived from the id so a person keeps the same colour everywhere. */
export function Avatar({ name, seed = 0, className }: { name: string; seed?: number; className?: string }) {
  return (
    <span aria-hidden className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold', TINTS[Math.abs(seed) % TINTS.length], className)}>
      {initials(name)}
    </span>
  );
}
