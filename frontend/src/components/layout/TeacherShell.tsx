import { ClipboardList, LayoutDashboard, LogOut, Menu, PencilLine, UserRound, Users, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { Brand } from '@/components/common/Brand';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth, useTeacher } from '@/features/auth/AuthProvider';
import { cn } from '@/lib/utils';

const NAV: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }> = [
  { to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/teacher/marks', label: 'Marks entry', icon: PencilLine },
  { to: '/teacher/students', label: 'Students', icon: Users },
  { to: '/teacher/assessments', label: 'Assessment records', icon: ClipboardList },
  { to: '/teacher/profile', label: 'Profile', icon: UserRound },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
              isActive ? 'bg-primary-soft text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <Icon className="size-[18px]" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function AccountBlock() {
  const { logout } = useAuth();
  const teacher = useTeacher();
  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center gap-3 px-1">
        <Avatar name={teacher.user.fullName} className="size-10" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold">{teacher.user.fullName}</p>
          <p className="text-xs text-muted-foreground">Teacher</p>
        </div>
      </div>
      <Button
        variant="ghost"
        className="w-full justify-start"
        onClick={() => void logout()}
      >
        <LogOut aria-hidden /> Sign out
      </Button>
    </div>
  );
}

export function TeacherShell() {
  const teacher = useTeacher();
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={200}>
      <a href="#main" className="sr-only z-[60] rounded-lg bg-card px-3 py-2 font-semibold shadow-pop focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-card p-4 lg:flex">
          <Brand subtitle={teacher.school.name} className="px-1 pt-1" />
          <NavList />
          <div className="mt-auto">
            <AccountBlock />
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/90 px-4 backdrop-blur lg:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent className="gap-6 p-4">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <SheetDescription className="sr-only">Main navigation</SheetDescription>
                <Brand subtitle={teacher.school.name} className="px-1 pt-1" />
                <NavList onNavigate={() => setOpen(false)} />
                <div className="mt-auto">
                  <AccountBlock />
                </div>
              </SheetContent>
            </Sheet>
            <Brand className="[&>div]:hidden sm:[&>div]:block" />
            <Avatar name={teacher.user.fullName} />
          </header>
          <main id="main" className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
