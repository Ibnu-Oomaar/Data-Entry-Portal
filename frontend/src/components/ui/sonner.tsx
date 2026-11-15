import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: '!rounded-xl !border !border-border !bg-card !text-foreground !shadow-pop !font-sans',
          description: '!text-muted-foreground',
        },
      }}
    />
  );
}
