import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { teacherLoginSchema, type TeacherLoginValues } from '@/schemas/login';
import { ApiError } from '@/services/api-client';
import { useAuth } from './AuthProvider';
import { LoginShell } from './LoginShell';

export function TeacherLoginPage() {
  const { loginTeacher, registerTeacher } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TeacherLoginValues>({ resolver: zodResolver(teacherLoginSchema), defaultValues: { name: '', password: '' } });

  const onSubmit = handleSubmit(async ({ name, password }) => {
    setFormError(null);
    try {
      const s = creating ? await registerTeacher(name, password) : await loginTeacher(name, password);
      toast.success(`Welcome, ${s.role === 'teacher' ? s.user.fullName : ''}`);
      navigate(from && from.startsWith('/teacher') ? from : '/teacher', { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not complete your request. Please try again.');
    }
  });

  return (
    <LoginShell
      title={creating ? 'Create teacher account' : 'Teacher sign in'}
      description={creating ? 'Create your account with your full name and a strong password. Class access is assigned separately by an administrator.' : 'Sign in with the name and password for your teacher account.'}
      footer={
        <p className="text-sm text-muted-foreground">
          {creating ? 'Already have an account?' : 'New teacher?'}{' '}
          <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setCreating(!creating); setFormError(null); }}>
            {creating ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Your full name</Label>
          <Input
            id="name"
            autoFocus
            autoComplete="name"
            placeholder="e.g. Amina Yusuf Ali"
            aria-invalid={!!errors.name || !!formError}
            aria-describedby={errors.name ? 'name-error' : formError ? 'form-error' : undefined}
            {...register('name', { onChange: () => setFormError(null) })}
          />
          {errors.name && (
            <p id="name-error" className="text-sm font-medium text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={creating ? 'new-password' : 'current-password'}
            aria-invalid={!!errors.password || !!formError}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password', { onChange: () => setFormError(null) })}
          />
          {errors.password && (
            <p id="password-error" className="text-sm font-medium text-destructive">
              {errors.password.message}
            </p>
          )}
          {creating && <p className="text-xs text-muted-foreground">Use at least 12 characters.</p>}
        </div>
        {formError && (
          <p id="form-error" role="alert" className="rounded-lg bg-pen-soft px-3 py-2.5 text-sm font-medium text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : creating ? <UserPlus aria-hidden /> : <LogIn aria-hidden />}
          {isSubmitting ? (creating ? 'Creating account…' : 'Signing in…') : creating ? 'Create account' : 'Sign in'}
        </Button>
      </form>
    </LoginShell>
  );
}
