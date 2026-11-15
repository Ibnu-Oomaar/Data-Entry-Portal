import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '@/components/common/Brand';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { schoolApi } from '@/services/api';

export function useSchool() {
  return useQuery({ queryKey: ['school'], queryFn: schoolApi.get, staleTime: 5 * 60_000, retry: 1 });
}

/** Shared frame for both sign-in pages: brand, the form card, and a way back. */
export function LoginShell({ title, description, children, footer }: { title: string; description: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const { data: school } = useSchool();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <Brand subtitle={school ? `${school.name} · ${school.shift} shift` : undefined} />
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 space-y-1.5">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </Card>
      {footer}
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Back to start
      </Link>
    </main>
  );
}
