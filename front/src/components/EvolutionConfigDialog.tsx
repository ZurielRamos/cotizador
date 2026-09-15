import { Eye, EyeOff, Loader2, Settings } from 'lucide-react';
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
  fetchEvolutionConfig,
  saveEvolutionConfig,
} from '@/lib/evolutionConfig';

type Props = {
  onSaved?: () => void;
};

function EvolutionConfigDialog({ onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMask, setApiKeyMask] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al abrir, carga el estado actual desde el backend.
  useEffect(() => {
    if (!open) return;

    setError(null);
    setShowKey(false);
    setApiKey('');
    setLoading(true);

    fetchEvolutionConfig()
      .then((cfg) => {
        setBaseUrl(cfg.baseUrl ?? '');
        setApiKeyMask(cfg.apiKeyMask);
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
    const trimmedUrl = baseUrl.trim();
    const trimmedKey = apiKey.trim();

    if (!trimmedUrl || !trimmedKey) {
      setError('La URL y el API Key son obligatorios.');
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setError('La URL no tiene un formato válido (ej. https://api.tu-dominio.com).');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveEvolutionConfig({ baseUrl: trimmedUrl, apiKey: trimmedKey });
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
          <Settings className="size-4" />
          Configurar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar Evolution API</DialogTitle>
          <DialogDescription>
            Ingresa la URL base y el API Key global de tu servidor de Evolution
            API. El API Key se guarda cifrado en el servidor.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="evo-url">URL base</Label>
              <Input
                id="evo-url"
                placeholder="https://evolution.tu-dominio.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="evo-key">API Key</Label>
              <div className="relative">
                <Input
                  id="evo-key"
                  type={showKey ? 'text' : 'password'}
                  placeholder={
                    apiKeyMask
                      ? `Guardado: ${apiKeyMask} — escribe para reemplazar`
                      : '••••••••••••••••'
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? 'Ocultar API Key' : 'Mostrar API Key'}
                >
                  {showKey ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {apiKeyMask ? (
                <p className="text-xs text-muted-foreground">
                  Ya hay un API Key guardado ({apiKeyMask}). Escribe uno nuevo
                  para reemplazarlo.
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

export default EvolutionConfigDialog;
