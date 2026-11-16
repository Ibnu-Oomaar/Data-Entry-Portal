
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ApiError, setCsrfToken, setUnauthorizedHandler } from '@/services/api-client';
import { authApi } from '@/services/api';
import type { Role, Session } from '@/types/api';

const SESSION_KEY = ['session'] as const;

interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'anonymous';
  session: Session | null;
  /** True after the person pressed "Sign out" (as opposed to a session that simply ended). */
  signedOut: boolean;
  role: Role | null;
  loginTeacher: (name: string) => Promise<Session>;
  loginStudent: (studentId: number) => Promise<Session>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchSession(): Promise<Session | null> {
  try {
    const s = await authApi.me();
    setCsrfToken(s.csrfToken);
    return s;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      setCsrfToken(null);
      return null;
    }
    throw err;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [signedOut, setSignedOut] = useState(false);
  const query = useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession, staleTime: Infinity, retry: 1, refetchOnWindowFocus: false });

  /** Forget everything cached for the previous person, but keep the session query itself (it is observed above). */
  const forgetData = useCallback(() => qc.removeQueries({ predicate: (q) => q.queryKey[0] !== SESSION_KEY[0] }), [qc]);

  const clear = useCallback(() => {
    setCsrfToken(null);
    forgetData();
    qc.setQueryData(SESSION_KEY, null);
  }, [qc, forgetData]);

  // Any API call that comes back 401 means the server ended the session (timeout, deactivated account…).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (qc.getQueryData(SESSION_KEY)) {
        clear();
        toast.info('Your session ended. Please sign in again.');
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [qc, clear]);

  const adopt = useCallback(
    (s: Session) => {
      setCsrfToken(s.csrfToken);
      forgetData();
      qc.setQueryData(SESSION_KEY, s);
      setSignedOut(false);
      return s;
    },
    [qc, forgetData],
  );

  const value = useMemo<AuthContextValue>(() => {
    const session = query.data ?? null;
    return {
      status: query.isPending ? 'loading' : session ? 'authenticated' : 'anonymous',
      session,
      signedOut,
      role: session?.role ?? null,
      loginTeacher: (name) => authApi.loginTeacher(name).then(adopt),
      loginStudent: (id) => authApi.loginStudent(id).then(adopt),
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          clear();
          setSignedOut(true);
        }
      },
    };
  }, [query.data, query.isPending, signedOut, adopt, clear]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function useTeacher() {
  const { session } = useAuth();
  if (session?.role !== 'teacher') throw new Error('useTeacher used outside a teacher session');
  return session;
}

export function useStudentSession() {
  const { session } = useAuth();
  if (session?.role !== 'student') throw new Error('useStudentSession used outside a student session');
  return session;
}
