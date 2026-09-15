import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceName: string | null;
  qrcode: string | null;
  pairingCode: string | null;
  loading?: boolean;
  error?: string | null;
};

function QrDialog({
  open,
  onOpenChange,
  instanceName,
  qrcode,
  pairingCode,
  loading,
  error,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular WhatsApp</DialogTitle>
          <DialogDescription>
            {instanceName
              ? `Escanea el código QR con WhatsApp para vincular la instancia "${instanceName}".`
              : 'Escanea el código QR con WhatsApp.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center gap-4 py-4">
          {loading ? (
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : qrcode ? (
            <img
              src={qrcode}
              alt="Código QR para vincular WhatsApp"
              className="size-64 rounded-lg border"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No se recibió un código QR. Intenta reconectar.
            </p>
          )}

          {pairingCode ? (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                O usa el código de emparejamiento:
              </p>
              <p className="mt-1 font-mono text-lg font-bold tracking-widest">
                {pairingCode}
              </p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default QrDialog;
