import { Loader2, LogIn } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/services/api-client';
import { useAuth } from './AuthProvider';
import { LoginShell } from './LoginShell';

const TEACHER_NAME = 'Khalid Harun';

export function TeacherPasswordLoginPage() {
  const { loginTeacher } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      const session = await loginTeacher(TEACHER_NAME, password);
      toast.success(`Welcome, ${session.role === 'teacher' ? session.user.fullName : TEACHER_NAME}`);
      navigate(from && from.startsWith('/teacher') ? from : '/teacher', { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiError || error instanceof Error ? error.message : 'Could not complete sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LoginShell
      title="Password sign in"
      description={`Sign in to the ${TEACHER_NAME} account.`}
      footer={
        <p className="text-sm text-muted-foreground">
          <Link to="/login/teacher" className="font-semibold text-primary hover:underline">
            Use a passkey instead
          </Link>
        </p>
      }
    >
      <form onSubmit={(event) => void signIn(event)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={!!formError}
            aria-describedby={formError ? 'form-error' : undefined}
            required
          />
        </div>
        {formError && (
          <p id="form-error" role="alert" className="rounded-lg bg-pen-soft px-3 py-2.5 text-sm font-medium text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !password}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </LoginShell>
  );
}
