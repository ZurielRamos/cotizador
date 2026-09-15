import { Eye, EyeOff, Loader2, MessagesSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  fetchChatwootConfig,
  saveChatwootConfig,
} from '@/lib/chatwootConfig';

type Props = {
  onSaved?: () => void;
};

function ChatwootConfigDialog({ onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [accountId, setAccountId] = useState('');
  const [token, setToken] = useState('');
  const [tokenMask, setTokenMask] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setShowToken(false);
    setToken('');
    setLoading(true);

    fetchChatwootConfig()
      .then((cfg) => {
        setBaseUrl(cfg.baseUrl ?? '');
        setAccountId(cfg.accountId ?? '');
        setTokenMask(cfg.tokenMask);
      })
      .catch((e: unknown) => {
        setError(
          e instanceof Error
            ? `No se pudo cargar la configuración: ${e.message}`
            : 'No se pudo cargar la configuración.',
        );
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleSave = async () => {
    const trimmedUrl = baseUrl.trim().replace(/\/+$/, '');
    const trimmedAccount = accountId.trim();
    const trimmedToken = token.trim();

    if (!trimmedUrl || !trimmedAccount || !trimmedToken) {
      setError('La URL, el Account ID y el token son obligatorios.');
      return;
    }
    try {
      new URL(trimmedUrl);
    } catch {
      setError('La URL no tiene un formato válido (ej. https://chatwoot.tu-dominio.com).');
      return;
    }
    if (!/^\d+$/.test(trimmedAccount)) {
      setError('El Account ID debe ser numérico.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveChatwootConfig({
        baseUrl: trimmedUrl,
        accountId: trimmedAccount,
        token: trimmedToken,
      });
      setOpen(false);
      onSaved?.();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'No se pudo guardar la configuración.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <MessagesSquare className="size-4" />
          Chatwoot
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar Chatwoot</DialogTitle>
          <DialogDescription>
            Ingresa la URL, el Account ID y el token de administrador de tu
            Chatwoot. Cada instancia nueva creará su bandeja (inbox)
            automáticamente. El token se guarda cifrado en el servidor.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="cw-url">URL base</Label>
              <Input
                id="cw-url"
                placeholder="https://chatwoot.tu-dominio.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cw-account">Account ID</Label>
              <Input
                id="cw-account"
                inputMode="numeric"
                placeholder="1"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cw-token">Token de administrador</Label>
              <div className="relative">
                <Input
                  id="cw-token"
                  type={showToken ? 'text' : 'password'}
                  placeholder={
                    tokenMask
                      ? `Guardado: ${tokenMask} — escribe para reemplazar`
                      : '••••••••••••••••'
                  }
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
                >
                  {showToken ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {tokenMask ? (
                <p className="text-xs text-muted-foreground">
                  Ya hay un token guardado ({tokenMask}). Escribe uno nuevo para
                  reemplazarlo.
                </p>
              ) : null}
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={saving}>
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ChatwootConfigDialog;
