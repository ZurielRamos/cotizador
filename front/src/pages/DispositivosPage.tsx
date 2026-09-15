import {
  Ban,
  Loader2,
  Lock,
  LockOpen,
  MessageCircle,
  Pause,
  Pencil,
  Play,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import ChatwootConfigDialog from '@/components/ChatwootConfigDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import CreateInstanceDialog from '@/components/CreateInstanceDialog';
import EditProfileDialog from '@/components/EditProfileDialog';
import EvolutionConfigDialog from '@/components/EvolutionConfigDialog';
import PageHeader from '@/components/PageHeader';
import QrDialog from '@/components/QrDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import WarmupConfigDialog from '@/components/WarmupConfigDialog';
import { cn } from '@/lib/utils';
import { fetchEvolutionConfig } from '@/lib/evolutionConfig';
import {
  blockInstance,
  connectInstance,
  deleteInstance,
  fetchInstances,
  unblockInstance,
  type EstadoConexion,
  type Instance,
} from '@/lib/evolutionApi';
import {
  fetchAvailability,
  pauseDevice,
  resumeDevice,
  syncDevices,
  type Availability,
} from '@/lib/warmup';

const estadoVariant: Record<
  EstadoConexion,
  'active' | 'scheduled' | 'executed'
> = {
  open: 'active',
  close: 'scheduled',
  connecting: 'executed',
};

const estadoLabel: Record<EstadoConexion, string> = {
  open: 'Conectado',
  close: 'Desconectado',
  connecting: 'Vinculando',
};

/** Iniciales para el fallback del avatar (máx. 2 caracteres). */
function iniciales(texto: string): string {
  const partes = texto.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/** Color de la barra de uso según qué tan cerca del límite diario está. */
function usoColor(ratio: number): string {
  if (ratio >= 0.9) return 'bg-red-500';
  if (ratio >= 0.6) return 'bg-amber-500';
  return 'bg-emerald-500';
}

/** Celda de warm-up: tier + reputación. */
function renderWarmup(a?: Availability) {
  if (!a) return <span className="text-muted-foreground">—</span>;
  const rep = Math.round(a.reputationScore * 100);
  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant="executed" className="w-fit">
        T{a.tier} · {a.tierLabel}
      </Badge>
      <span className="text-xs text-muted-foreground">
        Reputación {rep}%
        {a.ageDays !== null ? ` · ${a.ageDays}d` : ''}
      </span>
    </div>
  );
}

/** Celda de uso: barra sentToday/dailyLimit + restante. */
function renderUso(a?: Availability) {
  if (!a) return <span className="text-muted-foreground">—</span>;
  const ratio = a.dailyLimit > 0 ? a.sentToday / a.dailyLimit : 1;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${usoColor(ratio)}`}
            style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {a.sentToday}/{a.dailyLimit}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">
        {a.remainingToday} restantes hoy
      </span>
    </div>
  );
}

type QrState = {
  open: boolean;
  instanceName: string | null;
  qrcode: string | null;
  pairingCode: string | null;
  loading: boolean;
  error: string | null;
};

const emptyQr: QrState = {
  open: false,
  instanceName: null,
  qrcode: null,
  pairingCode: null,
  loading: false,
  error: null,
};

function DispositivosPage() {
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Advertencia no bloqueante (p. ej. Chatwoot no se pudo crear al crear la instancia).
  const [warning, setWarning] = useState<string | null>(null);
  const [qr, setQr] = useState<QrState>(emptyQr);
  // Disponibilidad de warm-up por nombre de instancia.
  const [disponibilidad, setDisponibilidad] = useState<
    Record<string, Availability>
  >({});
  const [sincronizando, setSincronizando] = useState(false);

  const cargarDisponibilidad = useCallback(async () => {
    try {
      const list = await fetchAvailability();
      const map: Record<string, Availability> = {};
      for (const a of list) map[a.instanceName] = a;
      setDisponibilidad(map);
    } catch {
      // La disponibilidad es informativa; no bloquea la vista de instancias.
      setDisponibilidad({});
    }
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await fetchEvolutionConfig();
      setConfigurado(cfg.configured);
      if (!cfg.configured) {
        setInstances([]);
        return;
      }
      const list = await fetchInstances();
      setInstances(list);
      await cargarDisponibilidad();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'No se pudieron cargar las instancias.',
      );
    } finally {
      setLoading(false);
    }
  }, [cargarDisponibilidad]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleSincronizar = async () => {
    setSincronizando(true);
    setError(null);
    setWarning(null);
    try {
      const res = await syncDevices();
      setWarning(
        `Sincronización: ${res.total} instancia(s), ${res.webhooksRegistrados} webhook(s) registrado(s), ${res.reputacionesSembradas} reputación(es) inicializada(s).`,
      );
      await cargarDisponibilidad();
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? `No se pudo sincronizar: ${e.message}`
          : 'No se pudo sincronizar.',
      );
    } finally {
      setSincronizando(false);
    }
  };

  const abrirQrReconectar = async (name: string) => {
    setQr({ ...emptyQr, open: true, instanceName: name, loading: true });
    try {
      const res = await connectInstance(name);
      setQr({
        open: true,
        instanceName: name,
        qrcode: res.qrcode,
        pairingCode: res.pairingCode,
        loading: false,
        error: null,
      });
    } catch (e: unknown) {
      setQr({
        open: true,
        instanceName: name,
        qrcode: null,
        pairingCode: null,
        loading: false,
        error: e instanceof Error ? e.message : 'No se pudo obtener el QR.',
      });
    }
  };

  // Instancia cuyo diálogo "Editar perfil" está abierto (control externo).
  const [editInstance, setEditInstance] = useState<Instance | null>(null);
  // Nombre de la instancia con una acción de menú en curso (bloqueo/eliminar).
  const [busyName, setBusyName] = useState<string | null>(null);

  /**
   * Ejecuta una acción y, si tiene éxito, aplica onSuccess sobre el estado
   * local sin recargar toda la lista (evita el parpadeo).
   */
  const ejecutarAccion = async (
    name: string,
    fn: () => Promise<void>,
    onSuccess: () => void,
  ) => {
    setBusyName(name);
    setError(null);
    try {
      await fn();
      onSuccess();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'No se pudo completar la acción.',
      );
    } finally {
      setBusyName(null);
    }
  };

  const setBlocked = (name: string, blocked: boolean) =>
    setInstances((prev) =>
      prev.map((i) => (i.name === name ? { ...i, blocked } : i)),
    );

  const handleBloquear = (inst: Instance) =>
    ejecutarAccion(
      inst.name,
      () => blockInstance(inst.name),
      () => setBlocked(inst.name, true),
    );

  const handleDesbloquear = (inst: Instance) =>
    ejecutarAccion(
      inst.name,
      () => unblockInstance(inst.name),
      () => setBlocked(inst.name, false),
    );

  const setPausedLocal = (name: string, paused: boolean) =>
    setDisponibilidad((prev) => {
      const a = prev[name];
      if (!a) return prev;
      return { ...prev, [name]: { ...a, paused, canSend: paused ? false : a.canSend } };
    });

  const handlePausar = (inst: Instance) =>
    ejecutarAccion(
      inst.name,
      () => pauseDevice(inst.name),
      () => setPausedLocal(inst.name, true),
    );

  const handleReanudar = (inst: Instance) =>
    ejecutarAccion(
      inst.name,
      () => resumeDevice(inst.name),
      () => setPausedLocal(inst.name, false),
    );

  // Instancia pendiente de confirmación de borrado.
  const [deleteTarget, setDeleteTarget] = useState<Instance | null>(null);

  const confirmarEliminar = () => {
    const inst = deleteTarget;
    if (!inst) return;
    void ejecutarAccion(
      inst.name,
      () => deleteInstance(inst.name),
      () => {
        setInstances((prev) => prev.filter((i) => i.name !== inst.name));
        setDeleteTarget(null);
      },
    );
  };

  const conectados = instances.filter((i) => i.connectionStatus === 'open')
    .length;

  return (
    <div>
      <PageHeader
        title="Dispositivos"
        description="Instancias de WhatsApp conectadas mediante Evolution API."
        actions={
          <>
            <Button variant="outline" onClick={cargar} disabled={loading}>
              <RefreshCw
                className={loading ? 'size-4 animate-spin' : 'size-4'}
              />
              Actualizar
            </Button>
            <Button
              variant="outline"
              onClick={handleSincronizar}
              disabled={sincronizando}
            >
              {sincronizando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Sincronizar
            </Button>
            <EvolutionConfigDialog onSaved={cargar} />
            <ChatwootConfigDialog />
            <WarmupConfigDialog onSaved={cargarDisponibilidad} />
            {configurado ? (
              <CreateInstanceDialog
                onCreated={(result) => {
                  setWarning(result.chatwootWarning);
                  setQr({
                    open: true,
                    instanceName: result.instance.name,
                    qrcode: result.qrcode,
                    pairingCode: result.pairingCode,
                    loading: false,
                    error: null,
                  });
                }}
              />
            ) : null}
          </>
        }
      />

      {configurado === false ? (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <TriangleAlert className="size-5 shrink-0" />
          <span>
            Evolution API no está configurado. Usa el botón{' '}
            <strong>Configurar</strong> para ingresar la URL y el API Key.
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          <TriangleAlert className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {warning ? (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <TriangleAlert className="size-5 shrink-0" />
          <span className="flex-1">{warning}</span>
          <button
            type="button"
            onClick={() => setWarning(null)}
            className="text-amber-700 hover:text-amber-900"
            aria-label="Descartar advertencia"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-4">
        <Card className="flex-1">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <MessageCircle className="size-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Conectados</p>
              <p className="text-xl font-bold">{conectados}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Smartphone className="size-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Total instancias</p>
              <p className="text-xl font-bold">{instances.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : instances.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {configurado
                ? 'No hay instancias todavía. Crea una con "Nueva instancia".'
                : 'Configura Evolution API para ver tus instancias.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instancia</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Warm-up</TableHead>
                  <TableHead>Uso hoy</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((inst) => (
                  <ContextMenu
                    key={inst.name}
                    as="tr"
                    className={cn(
                      'cursor-default select-none border-b transition-colors hover:bg-muted/50',
                      inst.blocked && 'bg-muted/40 hover:bg-muted/60',
                    )}
                    activeClassName={inst.blocked ? 'bg-muted/60' : 'bg-muted/50'}
                    content={
                      inst.blocked ? (
                        <ContextMenuItem
                          icon={<LockOpen className="size-4" />}
                          onSelect={() => handleDesbloquear(inst)}
                        >
                          Desbloquear
                        </ContextMenuItem>
                      ) : (
                        <>
                          {inst.connectionStatus === 'open' ? (
                            <ContextMenuItem
                              icon={<Pencil className="size-4" />}
                              onSelect={() => setEditInstance(inst)}
                            >
                              Editar perfil
                            </ContextMenuItem>
                          ) : (
                            <ContextMenuItem
                              icon={
                                inst.connectionStatus === 'connecting' ? (
                                  <QrCode className="size-4" />
                                ) : (
                                  <RefreshCw className="size-4" />
                                )
                              }
                              onSelect={() => abrirQrReconectar(inst.name)}
                            >
                              {inst.connectionStatus === 'connecting'
                                ? 'Ver QR'
                                : 'Reconectar'}
                            </ContextMenuItem>
                          )}
                          {disponibilidad[inst.name]?.paused ? (
                            <ContextMenuItem
                              icon={<Play className="size-4" />}
                              onSelect={() => handleReanudar(inst)}
                            >
                              Reanudar envíos
                            </ContextMenuItem>
                          ) : (
                            <ContextMenuItem
                              icon={<Pause className="size-4" />}
                              onSelect={() => handlePausar(inst)}
                            >
                              Pausar envíos
                            </ContextMenuItem>
                          )}
                          <ContextMenuItem
                            icon={<Ban className="size-4" />}
                            onSelect={() => handleBloquear(inst)}
                          >
                            Bloquear
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            variant="destructive"
                            icon={<Trash2 className="size-4" />}
                            onSelect={() => setDeleteTarget(inst)}
                          >
                            Eliminar
                          </ContextMenuItem>
                        </>
                      )
                    }
                  >
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-3">
                        <Avatar>
                          {inst.profilePicUrl ? (
                            <AvatarImage
                              src={inst.profilePicUrl}
                              alt={inst.profileName ?? inst.name}
                            />
                          ) : null}
                          <AvatarFallback className="bg-emerald-500">
                            {iniciales(inst.profileName ?? inst.name)}
                          </AvatarFallback>
                        </Avatar>
                        {inst.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inst.number ?? '—'}
                    </TableCell>
                    <TableCell>{inst.profileName ?? '—'}</TableCell>
                    <TableCell>{renderWarmup(disponibilidad[inst.name])}</TableCell>
                    <TableCell>{renderUso(disponibilidad[inst.name])}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {inst.blocked ? (
                          <Badge
                            variant="scheduled"
                            className="inline-flex items-center gap-1"
                          >
                            <Lock className="size-3" />
                            Bloqueada
                          </Badge>
                        ) : disponibilidad[inst.name]?.paused ? (
                          <Badge
                            variant="scheduled"
                            className="inline-flex items-center gap-1"
                          >
                            <Pause className="size-3" />
                            Pausada
                          </Badge>
                        ) : (
                          <Badge variant={estadoVariant[inst.connectionStatus]}>
                            {estadoLabel[inst.connectionStatus]}
                          </Badge>
                        )}
                        {busyName === inst.name ? (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        ) : null}
                      </div>
                    </TableCell>
                  </ContextMenu>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <QrDialog
        open={qr.open}
        onOpenChange={(open) => {
          setQr((prev) => ({ ...prev, open }));
          if (!open) cargar();
        }}
        instanceName={qr.instanceName}
        qrcode={qr.qrcode}
        pairingCode={qr.pairingCode}
        loading={qr.loading}
        error={qr.error}
      />

      {editInstance ? (
        <EditProfileDialog
          instance={editInstance}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditInstance(null);
          }}
          onSaved={cargar}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Eliminar instancia"
        description={
          deleteTarget ? (
            <>
              Se eliminará la instancia{' '}
              <strong>{deleteTarget.name}</strong> en Evolution API. Esta acción
              no se puede deshacer.
            </>
          ) : null
        }
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteTarget !== null && busyName === deleteTarget.name}
        onConfirm={confirmarEliminar}
      />
    </div>
  );
}

export default DispositivosPage;
