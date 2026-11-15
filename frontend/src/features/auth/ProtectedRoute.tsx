import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import type { Role } from '@/types/api';
import { useAuth } from './AuthProvider';

export const homeFor = (role: Role) => (role === 'teacher' ? '/teacher' : '/student');

export function FullScreenLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background" role="status" aria-label="Loading">
      <div className="w-64 space-y-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/**
 * Client-side routing guard — convenience only. The API enforces the same rules on every request,
 * so bypassing this component never exposes data.
 */
export function ProtectedRoute({ role }: { role: Role }) {
  const { status, session, signedOut } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullScreenLoading />;
  // After an explicit sign-out go to the start page (and forget where they were); a lapsed session returns to the same page after sign-in.
  if (!session && signedOut) return <Navigate to="/" replace />;
  if (!session) return <Navigate to={`/login/${role}`} replace state={{ from: location.pathname + location.search }} />;
  if (session.role !== role) return <Navigate to={homeFor(session.role)} replace />;
  return <Outlet />;
}

/** Login/landing pages bounce signed-in people to their own dashboard. */
export function PublicOnlyRoute() {
  const { status, session } = useAuth();
  if (status === 'loading') return <FullScreenLoading />;
  if (session) return <Navigate to={homeFor(session.role)} replace />;
  return <Outlet />;
}
