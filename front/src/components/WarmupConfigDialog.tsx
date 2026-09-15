import { Gauge, Loader2 } from 'lucide-react';
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
import TimezoneCombobox from '@/components/TimezoneCombobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  fetchWarmupConfig,
  saveWarmupConfig,
  type WarmupTier,
} from '@/lib/warmup';

type Props = {
  onSaved?: () => void;
};

function WarmupConfigDialog({ onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [timezone, setTimezone] = useState('');
  const [windowStartHour, setWindowStartHour] = useState('8');
  const [windowEndHour, setWindowEndHour] = useState('21');
  const [pauseThreshold, setPauseThreshold] = useState('0.4');
  const [minMultiplier, setMinMultiplier] = useState('0.5');
  const [tiers, setTiers] = useState<WarmupTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    fetchWarmupConfig()
      .then((cfg) => {
        setTimezone(cfg.timezone);
        setWindowStartHour(String(cfg.windowStartHour));
        setWindowEndHour(String(cfg.windowEndHour));
        setPauseThreshold(cfg.pauseThreshold);
        setMinMultiplier(cfg.minReputationMultiplier);
        setTiers(cfg.tiers);
      })
      .catch((e: unknown) =>
        setError(
          e instanceof Error
            ? `No se pudo cargar la configuración: ${e.message}`
            : 'No se pudo cargar la configuración.',
        ),
      )
      .finally(() => setLoading(false));
  }, [open]);

  const handleSave = async () => {
    const start = Number(windowStartHour);
    const end = Number(windowEndHour);
    const pause = Number(pauseThreshold);
    const mult = Number(minMultiplier);

    if (!timezone.trim()) {
      setError('La zona horaria es obligatoria.');
      return;
    }
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      start > 23 ||
      end < 0 ||
      end > 23
    ) {
      setError('Las horas deben ser enteros entre 0 y 23.');
      return;
    }
    if (pause < 0 || pause > 1 || mult < 0 || mult > 1) {
      setError('El umbral y el multiplicador deben estar entre 0 y 1.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveWarmupConfig({
        timezone: timezone.trim(),
        windowStartHour: start,
        windowEndHour: end,
        pauseThreshold: pause,
        minReputationMultiplier: mult,
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
          <Gauge className="size-4" />
          Warm-up
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar warm-up y límites</DialogTitle>
          <DialogDescription>
            Ventana de envío y reglas de reputación aplicadas a todos los
            dispositivos.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="wu-tz">Zona horaria (IANA)</Label>
              <TimezoneCombobox
                id="wu-tz"
                value={timezone}
                onChange={setTimezone}
                placeholder="Busca una zona (ej. America/Mexico_City)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="wu-start">Hora inicio (0-23)</Label>
                <Input
                  id="wu-start"
                  inputMode="numeric"
                  value={windowStartHour}
                  onChange={(e) => setWindowStartHour(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="wu-end">Hora fin (0-23)</Label>
                <Input
                  id="wu-end"
                  inputMode="numeric"
                  value={windowEndHour}
                  onChange={(e) => setWindowEndHour(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="wu-pause">Umbral de pausa (0-1)</Label>
                <Input
                  id="wu-pause"
                  inputMode="decimal"
                  value={pauseThreshold}
                  onChange={(e) => setPauseThreshold(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Si la reputación cae debajo, el dispositivo se pausa solo.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="wu-mult">Multiplicador mínimo (0-1)</Label>
                <Input
                  id="wu-mult"
                  inputMode="decimal"
                  value={minMultiplier}
                  onChange={(e) => setMinMultiplier(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Piso del efecto de la reputación sobre los límites.
                </p>
              </div>
            </div>

            {tiers.length > 0 ? (
              <div className="rounded-md border">
                <div className="border-b px-3 py-2 text-xs font-semibold text-muted-foreground">
                  Escala de tiers (por antigüedad)
                </div>
                <div className="divide-y text-sm">
                  {[...tiers]
                    .sort((a, b) => a.minDays - b.minDays)
                    .map((t) => (
                      <div
                        key={t.tier}
                        className="flex items-center justify-between px-3 py-1.5"
                      >
                        <span className="font-medium">
                          T{t.tier} · {t.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          desde {t.minDays}d · {t.dailyLimit}/día ·{' '}
                          {t.hourlyLimit}/h
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

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

export default WarmupConfigDialog;
