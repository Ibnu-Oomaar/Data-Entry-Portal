import { formatMark } from '@/lib/assessment';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: { box: 'h-[3.75rem] w-[6.25rem]', text: 'text-[1.9rem]', max: 'text-[1.1rem]' },
  md: { box: 'h-[5.5rem] w-[9.25rem]', text: 'text-[3rem]', max: 'text-[1.6rem]' },
  lg: { box: 'h-[8rem] w-[13.5rem]', text: 'text-[4.6rem]', max: 'text-[2.4rem]' },
} as const;

type Size = keyof typeof SIZES;

/**
 * The portal's one flourish: handwriting in red pen with a hand-drawn ring around it, like a mark on a
 * graded exercise book. Presentational only.
 */
export function RedPenMark({
  children,
  size = 'md',
  animate = false,
  faded = false,
  label,
  className,
}: {
  children: React.ReactNode;
  size?: Size;
  animate?: boolean;
  faded?: boolean;
  label: string;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <div role="img" aria-label={label} className={cn('relative inline-flex select-none items-center justify-center text-pen', s.box, className)}>
      <svg viewBox="0 0 200 120" className={cn('absolute inset-0 size-full', animate && 'pen-ring', faded && 'opacity-40')} fill="none" aria-hidden>
        <path
          pathLength={520}
          d="M34 64 C 30 30, 82 9, 114 10 C 162 12, 192 38, 187 68 C 182 99, 140 113, 97 111 C 50 109, 18 92, 22 58 C 24 38, 40 27, 60 21"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={cn('font-hand relative -rotate-3 font-bold leading-none tracking-tight', s.text)} aria-hidden>
        {children}
      </span>
    </div>
  );
}

/** A real total written as "22/30". Pass null while nothing is entered yet. */
export function RedPenScore({ value, max = 30, size = 'md', animate = false, className }: { value: number | null; max?: number; size?: Size; animate?: boolean; className?: string }) {
  return (
    <RedPenMark
      size={size}
      animate={animate}
      faded={value == null}
      className={className}
      label={value == null ? `No total yet, out of ${max}` : `Total ${formatMark(value)} out of ${max}`}
    >
      {value == null ? '–' : formatMark(value)}
      <span className={cn('ml-0.5 font-semibold opacity-80', SIZES[size].max)}>/{max}</span>
    </RedPenMark>
  );
}
