import { CheckCircle2, CircleDashed, PencilLine } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ListStatus } from '@/types/api';

const META = {
  submitted: { label: 'Completed', variant: 'good', Icon: CheckCircle2 },
  draft: { label: 'In progress', variant: 'amber', Icon: PencilLine },
  pending: { label: 'Not started', variant: 'neutral', Icon: CircleDashed },
} as const;

export const STATUS_LABEL: Record<ListStatus, string> = { submitted: 'Completed', draft: 'In progress', pending: 'Not started' };

/** Colour is never the only signal: every status also has an icon and a word. */
export function StatusBadge({ status }: { status: ListStatus }) {
  const { label, variant, Icon } = META[status];
  return (
    <Badge variant={variant}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </Badge>
  );
}
