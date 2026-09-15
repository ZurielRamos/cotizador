import {
  Gauge,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Send,
  Square,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  cancelCampania,
  fetchProgramacionCampaign,
  iniciarProgramacionCampaign,
  pauseCampania,
  startCampania,
  type Campaign,
  type CampaignStatus,
  type ProgramacionCampaignSummary,
} from '@/lib/campanias';

const estadoLabel: Record<CampaignStatus, string> = {
  draft: 'Borrador',
  running: 'En curso',
  paused: 'Pausada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const estadoVariant: Record<
  CampaignStatus,
  'default' | 'active' | 'scheduled' | 'executed'
> = {
  draft: 'default',
  running: 'active',
  paused: 'executed',
  completed: 'executed',
  cancelled: 'scheduled',
};

type Props = {
  programacionId: number;
};

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function ProgramacionCampaignPanel({ programacionId }: Props) {
  const [summary, setSummary] = useState<ProgramacionCampaignSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    fetchProgramacionCampaign(programacionId)
      .then(setSummary)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'No se pudo cargar.'),
      )
      .finally(() => setLoading(false));
  }, [programacionId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Auto-refresco mientras la campaña esté en curso.
  useEffect(() => {
    if (summary?.campaign?.estado !== 'running') return;
    const t = setInterval(() => {
      fetchProgramacionCampaign(programacionId)
        .then(setSummary)
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [summary, programacionId]);

  const accion = async (fn: () => Promise<Campaign>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      cargar();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'No se pudo completar la acción.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Calculando campaña…
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const camp = summary.campaign;
  const activa =
    camp && (camp.estado === 'running' || camp.estado === 'paused');
  const sinDispositivos = summary.dispositivosDisponibles === 0;
  const sinNumeros = summary.numerosDisponibles === 0;
  const puedeIniciar = !activa && camp?.estado !== 'completed';

  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Send className="size-4 text-muted-foreground" />
            <h2 className="font-semibold">Campaña</h2>
            {camp ? (
              <Badge variant={estadoVariant[camp.estado]}>
                {estadoLabel[camp.estado]}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">
                No iniciada
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {busy ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : null}
            {puedeIniciar ? (
              <Button
                disabled={busy || sinNumeros || sinDispositivos}
                onClick={() => setConfirmOpen(true)}
              >
                <Play className="size-4" />
                Iniciar campaña
              </Button>
            ) : null}
            {camp?.estado === 'running' ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => accion(() => pauseCampania(camp.id))}
              >
                <Pause className="size-4" />
                Pausar
              </Button>
            ) : null}
            {camp?.estado === 'paused' ? (
              <Button
                disabled={busy}
                onClick={() => accion(() => startCampania(camp.id))}
              >
                <Play className="size-4" />
                Reanudar
              </Button>
            ) : null}
            {activa ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => accion(() => cancelCampania(camp.id))}
              >
                <Square className="size-4" />
                Cancelar
              </Button>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mb-3 text-sm text-destructive">{error}</p>
        ) : null}

        {puedeIniciar && (sinDispositivos || sinNumeros) ? (
          <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {sinNumeros
              ? 'La programación no tiene teléfonos válidos para enviar.'
              : 'No hay dispositivos conectados y disponibles. Conecta al menos un dispositivo para poder iniciar la campaña.'}
          </p>
        ) : null}

        {camp ? (
          // Campaña existente: mostrar progreso.
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Metric
              icon={<Users className="size-4" />}
              label="Destinatarios"
              value={camp.progreso.total}
            />
            <Metric
              icon={<Send className="size-4" />}
              label="Enviados"
              value={camp.progreso.sent}
            />
            <Metric
              icon={<Gauge className="size-4" />}
              label="Pendientes"
              value={camp.progreso.pending + camp.progreso.sending}
            />
            <Metric
              icon={<MessageSquare className="size-4" />}
              label="Respondidas"
              value={camp.progreso.respondidas}
            />
            <Metric
              icon={<Square className="size-4" />}
              label="Fallidos"
              value={camp.progreso.failed}
            />
          </div>
        ) : (
          // Sin campaña: mostrar estimación.
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Metric
              icon={<Users className="size-4" />}
              label="Números (tel. 1)"
              value={summary.numerosDisponibles}
            />
            <Metric
              icon={<Send className="size-4" />}
              label="Plantillas activas"
              value={summary.plantillasActivas}
            />
            <Metric
              icon={<Gauge className="size-4" />}
              label="Dispositivos disp."
              value={`${summary.dispositivosDisponibles}/${summary.dispositivosConectados}`}
            />
            <Metric
              icon={<Gauge className="size-4" />}
              label="Capacidad/día"
              value={summary.capacidadDiaria}
            />
            <Metric
              icon={<Gauge className="size-4" />}
              label="Días estimados"
              value={summary.diasEstimados ?? '—'}
            />
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Iniciar campaña"
        description={
          <>
            Se enviarán mensajes reales a{' '}
            <strong>{summary.numerosDisponibles}</strong> número(s) usando{' '}
            <strong>{summary.plantillasActivas}</strong> plantilla(s) activa(s),
            repartidos entre <strong>{summary.dispositivosDisponibles}</strong>{' '}
            dispositivo(s) disponible(s). El ritmo respeta los límites de
            warm-up. ¿Iniciar ahora?
          </>
        }
        confirmLabel="Iniciar campaña"
        loading={busy}
        onConfirm={() =>
          accion(() => iniciarProgramacionCampaign(programacionId)).then(() =>
            setConfirmOpen(false),
          )
        }
      />
    </Card>
  );
}

export default ProgramacionCampaignPanel;
