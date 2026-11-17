import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import { Fingerprint, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authApi } from '@/services/api';

export function TeacherPasskeySetup() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supportsPasskeys = browserSupportsWebAuthn();
  const passkeys = useQuery({ queryKey: ['auth', 'teacher-passkeys'], queryFn: authApi.passkeys });

  const addPasskey = async () => {
    setIsSubmitting(true);
    try {
      const { flowId, options } = await authApi.passkeyRegistrationOptions();
      const response = await startRegistration({ optionsJSON: options });
      await authApi.verifyPasskeyRegistration(flowId, response);
      await passkeys.refetch();
      toast.success('Passkey added. You can use it the next time you sign in.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add a passkey. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passkey sign in</CardTitle>
        <CardDescription>
          Use this device’s screen lock or a security key to sign in without typing your password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!supportsPasskeys ? (
          <p className="text-sm text-muted-foreground">Passkeys are not supported in this browser.</p>
        ) : passkeys.isError ? (
          <p role="alert" className="text-sm text-destructive">{(passkeys.error as Error).message}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {passkeys.isPending
                ? 'Checking passkey setup…'
                : passkeys.data.count === 0
                  ? 'No passkeys are registered yet.'
                  : `${passkeys.data.count} passkey${passkeys.data.count === 1 ? '' : 's'} registered.`}
            </p>
            <Button type="button" variant="outline" onClick={() => void addPasskey()} disabled={isSubmitting || passkeys.isPending}>
              {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <Fingerprint aria-hidden />}
              {isSubmitting ? 'Setting up…' : passkeys.data?.count ? 'Add another passkey' : 'Set up a passkey'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
