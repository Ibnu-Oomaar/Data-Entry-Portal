
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, LogIn } from 'lucide-react';
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
  const { loginTeacher } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TeacherLoginValues>({ resolver: zodResolver(teacherLoginSchema), defaultValues: { name: '' } });

  const onSubmit = handleSubmit(async ({ name }) => {
    setFormError(null);
    try {
      const s = await loginTeacher(name);
      toast.success(`Welcome, ${s.role === 'teacher' ? s.user.fullName : ''}`);
      navigate(from && from.startsWith('/teacher') ? from : '/teacher', { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not complete your request. Please try again.');
    }
  });

  return (
    <LoginShell
      title="Teacher sign in"
      description="Sign in with your registered full name."
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
        {formError && (
          <p id="form-error" role="alert" className="rounded-lg bg-pen-soft px-3 py-2.5 text-sm font-medium text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </LoginShell>
  );
}
