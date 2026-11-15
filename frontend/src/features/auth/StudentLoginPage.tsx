import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { studentLoginSchema, type StudentLoginValues } from '@/schemas/login';
import { ApiError } from '@/services/api-client';
import { useAuth } from './AuthProvider';
import { LoginShell } from './LoginShell';

export function StudentLoginPage() {
  const { loginStudent } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StudentLoginValues>({ resolver: zodResolver(studentLoginSchema), defaultValues: { studentId: '' } });

  const onSubmit = handleSubmit(async ({ studentId }) => {
    setFormError(null);
    try {
      await loginStudent(Number(studentId));
      navigate('/student', { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not sign you in. Please try again.');
    }
  });

  return (
    <LoginShell title="Student sign in" description="Enter your Student ID to see your own assessment marks.">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="studentId">Student ID</Label>
          <Input
            id="studentId"
            autoFocus
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 11516"
            className="h-12 text-lg tracking-wide"
            aria-invalid={!!errors.studentId || !!formError}
            aria-describedby={errors.studentId ? 'id-error' : formError ? 'form-error' : undefined}
            {...register('studentId', { onChange: () => setFormError(null) })}
          />
          {errors.studentId && (
            <p id="id-error" className="text-sm font-medium text-destructive">
              {errors.studentId.message}
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
          {isSubmitting ? 'Signing in…' : 'See my marks'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">Your ID is private. Only you can see your marks — please don’t share it.</p>
      </form>
    </LoginShell>
  );
}
