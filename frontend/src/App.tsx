import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { FullScreenLoading, ProtectedRoute, PublicOnlyRoute } from '@/features/auth/ProtectedRoute';
import { NotFoundPage, RouteError } from '@/features/NotFoundPage';
import { ApiError } from '@/services/api-client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // Don't retry "you can't do that" answers; do retry flaky networks once or twice.
      retry: (count, err) => !(err instanceof ApiError && err.status > 0 && err.status < 500) && count < 2,
    },
  },
});

/**
 * Route-level code splitting: each screen is downloaded when it is first visited, so the login page
 * does not carry the charts and the data-entry workspace.
 */
const page =
  <T extends Record<string, unknown>>(load: () => Promise<T>, name: keyof T) =>
  async () => ({ Component: (await load())[name] as React.ComponentType });

const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    hydrateFallbackElement: <FullScreenLoading />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: '/', lazy: page(() => import('@/features/auth/LandingPage'), 'LandingPage') },
          { path: '/login/teacher', lazy: page(() => import('@/features/auth/TeacherLoginPage'), 'TeacherLoginPage') },
          { path: '/login/teacher/password', lazy: page(() => import('@/features/auth/TeacherPasswordLoginPage'), 'TeacherPasswordLoginPage') },
          { path: '/login/student', lazy: page(() => import('@/features/auth/StudentLoginPage'), 'StudentLoginPage') },
        ],
      },
      {
        element: <ProtectedRoute role="teacher" />,
        children: [
          {
            path: '/teacher',
            lazy: page(() => import('@/components/layout/TeacherShell'), 'TeacherShell'),
            children: [
              { index: true, lazy: page(() => import('@/features/dashboard/TeacherDashboardPage'), 'TeacherDashboardPage') },
              { path: 'marks', lazy: page(() => import('@/features/marks/MarksWorkspacePage'), 'MarksWorkspacePage') },
              { path: 'students', lazy: page(() => import('@/features/students/StudentRecordsPage'), 'StudentRecordsPage') },
              { path: 'assessments', lazy: page(() => import('@/features/assessments/AssessmentRecordsPage'), 'AssessmentRecordsPage') },
              { path: 'profile', lazy: page(() => import('@/features/profile/ProfilePage'), 'ProfilePage') },
            ],
          },
        ],
      },
      {
        element: <ProtectedRoute role="student" />,
        children: [
          {
            path: '/student',
            lazy: page(() => import('@/components/layout/StudentShell'), 'StudentShell'),
            children: [
              { index: true, lazy: page(() => import('@/features/student-portal/StudentDashboardPage'), 'StudentDashboardPage') },
              { path: 'profile', lazy: page(() => import('@/features/profile/ProfilePage'), 'ProfilePage') },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
