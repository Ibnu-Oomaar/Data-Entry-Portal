import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Compass className="size-7" aria-hidden />
      </span>
      <h1 className="text-2xl font-bold">This page doesn’t exist</h1>
      <p className="max-w-sm text-sm text-muted-foreground">The link may be old or mistyped. Go back to the start and sign in again.</p>
      <Button asChild>
        <Link to="/">Back to start</Link>
      </Button>
    </main>
  );
}

export function RouteError() {
  return (
    <main role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">The page hit an unexpected problem. Your saved marks are safe. Reload to try again.</p>
      <Button onClick={() => window.location.assign('/')}>Reload</Button>
    </main>
  );
}
