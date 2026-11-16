import { Download, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/services/api-client';
import { Button } from '@/components/ui/button';

export function ExcelExportButton({ download, filename }: { download: () => Promise<Blob>; filename: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const exportFile = async () => {
    setIsDownloading(true);
    try {
      const blob = await download();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button variant="outline" onClick={exportFile} disabled={isDownloading}>
      {isDownloading ? <LoaderCircle className="animate-spin" aria-hidden /> : <Download aria-hidden />}
      {isDownloading ? 'Preparing…' : 'Export Excel'}
    </Button>
  );
}
