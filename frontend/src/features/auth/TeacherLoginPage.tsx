import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import { Fingerprint, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/services/api-client';
import { authApi } from '@/services/api';
import { useAuth } from './AuthProvider';
import { LoginShell } from './LoginShell';

const TEACHER_NAME = 'Khalid Harun';

export function TeacherLoginPage() {
  const { loginTeacherWithPasskey } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supportsPasskeys = browserSupportsWebAuthn();

  const signIn = async () => {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const { flowId, options } = await authApi.passkeyLoginOptions();
      const response = await startAuthentication({ optionsJSON: options });
      const session = await loginTeacherWithPasskey(flowId, response);
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
      title="Teacher sign in"
      description="Sign in securely with Khalid Harun’s passkey."
      footer={
        <p className="text-sm text-muted-foreground">
          Use password sign in if you need to set up or recover a passkey:{' '}
          <Link to="/login/teacher/password" className="font-semibold text-primary hover:underline">
            Continue with password
          </Link>
        </p>
      }
    >
      <div className="space-y-5">
        <p className="text-center text-lg font-semibold">{TEACHER_NAME}</p>
        {!supportsPasskeys && (
          <p role="status" className="text-sm text-muted-foreground">
            Passkeys are not available in this browser. Use password sign in to continue.
          </p>
        )}
        {formError && (
          <p role="alert" className="rounded-lg bg-pen-soft px-3 py-2.5 text-sm font-medium text-destructive">
            {formError}
          </p>
        )}
        <Button type="button" size="lg" className="w-full" disabled={!supportsPasskeys || isSubmitting} onClick={() => void signIn()}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <Fingerprint aria-hidden />}
          {isSubmitting ? 'Verifying passkey…' : `Continue as ${TEACHER_NAME}`}
        </Button>
      </div>
    </LoginShell>
  );
}
