import { AlertTriangle, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  fetchCampaignsByProgramacion,
  type CampaignByProgramacion,
  type CampaignStatus,
} from '@/lib/campanias';
import {
  cargarProgramacion,
  fetchProgramaciones,
  type Programacion,
} from '@/lib/programaciones';

const campEstadoLabel: Record<CampaignStatus, string> = {
  draft: 'Borrador',
  running: 'En curso',
  paused: 'Pausada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const campEstadoVariant: Record<
  CampaignStatus,
  'default' | 'active' | 'scheduled' | 'executed'
> = {
  draft: 'default',
  running: 'active',
  paused: 'executed',
  completed: 'executed',
  cancelled: 'scheduled',
};

function formatFecha(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type Aviso = { tipo: 'exito' | 'duplicada' | 'error'; texto: string };

function ProgramacionesPage() {
  const navigate = useNavigate();
  const [programaciones, setProgramaciones] = useState<Programacion[]>([]);
  const [campanias, setCampanias] = useState<CampaignByProgramacion>({});
  const [loading, setLoading] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const cargarLista = useCallback(() => {
    setLoading(true);
    fetchProgramaciones()
      .then(setProgramaciones)
      .catch((e: unknown) =>
        setAviso({
          tipo: 'error',
          texto:
            e instanceof Error
              ? `No se pudieron cargar las programaciones: ${e.message}`
              : 'No se pudieron cargar las programaciones.',
        }),
      )
      .finally(() => setLoading(false));
    // La info de campañas es complementaria; no bloquea el listado.
    fetchCampaignsByProgramacion()
      .then(setCampanias)
      .catch(() => setCampanias({}));
  }, []);

  useEffect(() => {
    cargarLista();
  }, [cargarLista]);

  // Auto-refresco del mapa de campañas mientras haya alguna en curso.
  useEffect(() => {
    const hayActivas = Object.values(campanias).some(
      (c) => c.estado === 'running',
    );
    if (!hayActivas) return;
    const t = setInterval(() => {
      fetchCampaignsByProgramacion()
        .then(setCampanias)
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [campanias]);

  const handleCargar = async () => {
    setCargando(true);
    setAviso(null);
    try {
      const res = await cargarProgramacion();
      if (res.yaCargada) {
        // La programación ya existía: alertamos y no recargamos nada.
        setAviso({
          tipo: 'duplicada',
          texto: `La programación #${res.programacion.id} ya está cargada. No se cargó nuevamente.`,
        });
        return;
      }
      setAviso({
        tipo: 'exito',
        texto: `Programación #${res.programacion.id} cargada correctamente.`,
      });
      cargarLista();
    } catch (e: unknown) {
      setAviso({
        tipo: 'error',
        texto:
          e instanceof Error
            ? `No se pudo cargar la programación: ${e.message}`
            : 'No se pudo cargar la programación.',
      });
    } finally {
      setCargando(false);
    }
  };

  const avisoStyles: Record<Aviso['tipo'], string> = {
    exito: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
    duplicada: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
    error: 'border-destructive/40 bg-destructive/10 text-destructive',
  };

  return (
    <div>
      <PageHeader
        title="Programaciones"
        description="Carga la programación telefónica desde el servicio externo."
        actions={
          <Button onClick={handleCargar} disabled={cargando}>
            {cargando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Cargar programación
          </Button>
        }
      />

      {aviso ? (
        <div
          className={`mb-4 flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${avisoStyles[aviso.tipo]}`}
        >
          {aviso.tipo === 'exito' ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{aviso.texto}</span>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Cargando programaciones…
            </div>
          ) : programaciones.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aún no hay programaciones. Usa “Cargar programación” para traer la
              más reciente.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Fecha inicio</TableHead>
                  <TableHead>Fecha fin</TableHead>
                  <TableHead>Cargada</TableHead>
                  <TableHead>Campaña</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programaciones.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/programaciones/${p.id}`)}
                  >
                    <TableCell className="font-medium tabular-nums">
                      #{p.id}
                    </TableCell>
                    <TableCell>{formatFecha(p.fechaInicio)}</TableCell>
                    <TableCell>{formatFecha(p.fechaFin)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFecha(p.creadoEn)}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const c = campanias[p.id];
                        if (!c) {
                          return (
                            <span className="text-xs text-muted-foreground">
                              Sin campaña
                            </span>
                          );
                        }
                        const done = c.progreso.sent + c.progreso.failed;
                        return (
                          <div className="flex items-center gap-2">
                            <Badge variant={campEstadoVariant[c.estado]}>
                              {campEstadoLabel[c.estado]}
                            </Badge>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {done}/{c.progreso.total}
                            </span>
                          </div>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ProgramacionesPage;
