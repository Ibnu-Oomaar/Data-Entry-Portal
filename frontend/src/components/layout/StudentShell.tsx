import { LogOut, UserRound } from 'lucide-react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { Brand } from '@/components/common/Brand';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth, useStudentSession } from '@/features/auth/AuthProvider';

export function StudentShell() {
  const { logout } = useAuth();
  const student = useStudentSession();
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-[60] rounded-lg bg-card px-3 py-2 font-semibold shadow-pop focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link to="/student" aria-label="My marks">
            <Brand subtitle={student.school.name} />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full focus-visible:outline-offset-4" aria-label="Account menu">
              <Avatar name={student.user.name} className="size-10" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <span className="block text-sm font-semibold text-foreground">{student.user.name}</span>
                Student ID {student.user.studentId}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate('/student/profile')}>
                <UserRound /> My profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void logout()}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-9">
        <Outlet />
      </main>
    </div>
  );
}
