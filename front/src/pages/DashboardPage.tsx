import type { LucideIcon } from 'lucide-react';
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  MessageCircle,
  MessagesSquare,
  Send,
  Smartphone,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  fetchCampaignsByProgramacion,
  type CampaignByProgramacion,
  type CampaignStatus,
} from '@/lib/campanias';
import { fetchInstances, type Instance } from '@/lib/evolutionApi';
import { fetchPlantillas, type Plantilla } from '@/lib/plantillas';
import {
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

type Kpi = {
  to: string;
  label: string;
  value: string;
  hint: string;
  Icon: LucideIcon;
  color: string;
};

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function DashboardPage() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [programaciones, setProgramaciones] = useState<Programacion[]>([]);
  const [campanias, setCampanias] = useState<CampaignByProgramacion>({});

  useEffect(() => {
    fetchPlantillas()
      .then(setPlantillas)
      .catch(() => setPlantillas([]));
    fetchInstances()
      .then(setInstances)
      .catch(() => setInstances([]));
    fetchProgramaciones()
      .then(setProgramaciones)
      .catch(() => setProgramaciones([]));
    fetchCampaignsByProgramacion()
      .then(setCampanias)
      .catch(() => setCampanias({}));
  }, []);

  // Auto-refresco del progreso de campañas mientras haya alguna en curso.
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

  const dispositivosEnLinea = instances.filter(
    (i) => i.connectionStatus === 'open',
  ).length;

  // Agregados de todas las campañas (envíos, respuestas, cotizaciones).
  const totales = useMemo(() => {
    const acc = {
      total: 0,
      enviados: 0,
      fallidos: 0,
      respondidas: 0,
      cotizaciones: 0,
    };
    for (const p of plantillas) {
      acc.cotizaciones += p.cotizacionesObtenidas;
    }
    for (const c of Object.values(campanias)) {
      acc.total += c.progreso.total;
      acc.enviados += c.progreso.sent;
      acc.fallidos += c.progreso.failed;
      acc.respondidas += c.progreso.respondidas;
    }
    return acc;
  }, [campanias, plantillas]);

  const campañasActivas = useMemo(
    () =>
      Object.entries(campanias)
        .map(([progId, c]) => ({ progId: Number(progId), ...c }))
        .filter(
          (c) => c.estado === 'running' || c.estado === 'paused',
        )
        .sort((a, b) => b.progreso.total - a.progreso.total),
    [campanias],
  );

  const topPlantillas = useMemo(
    () =>
      [...plantillas]
        .filter((p) => p.vecesUsada > 0)
        .sort((a, b) => b.tasaEfectividad - a.tasaEfectividad)
        .slice(0, 5),
    [plantillas],
  );

  const kpis: Kpi[] = [
    {
      to: '/plantillas',
      label: 'Plantillas activas',
      value: String(plantillas.filter((p) => p.activa).length),
      hint: `${plantillas.length} en total`,
      Icon: FileText,
      color: 'from-indigo-500 to-violet-600',
    },
    {
      to: '/programaciones',
      label: 'Programaciones',
      value: String(programaciones.length),
      hint: `${campañasActivas.length} campañas activas`,
      Icon: CalendarClock,
      color: 'from-amber-500 to-orange-600',
    },
    {
      to: '/dispositivos',
      label: 'Dispositivos conectados',
      value: `${dispositivosEnLinea}/${instances.length}`,
      hint: `${instances.length - dispositivosEnLinea} fuera de línea`,
      Icon: MessageCircle,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      to: '/programaciones',
      label: 'Mensajes enviados',
      value: totales.enviados.toLocaleString('es-MX'),
      hint: `${totales.fallidos} fallidos · ${totales.total} en cola`,
      Icon: Send,
      color: 'from-sky-500 to-blue-600',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Inicio"
        description="Resumen general del cotizador."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ to, label, value, hint, Icon, color }) => (
          <Link key={label} to={to}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-2 text-3xl font-bold tabular-nums">
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
                </div>
                <span
                  className={`flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white`}
                >
                  <Icon className="size-6" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Embudo de resultados */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <FunnelCard
          Icon={Send}
          label="Enviados"
          value={totales.enviados}
          sub={`de ${totales.total} destinatarios`}
          barPct={pct(totales.enviados, totales.total)}
          color="bg-sky-500"
        />
        <FunnelCard
          Icon={MessagesSquare}
          label="Respuestas"
          value={totales.respondidas}
          sub={`${pct(totales.respondidas, totales.enviados)}% de los enviados`}
          barPct={pct(totales.respondidas, totales.enviados)}
          color="bg-violet-500"
        />
        <FunnelCard
          Icon={CheckCircle2}
          label="Cotizaciones"
          value={totales.cotizaciones}
          sub={`${pct(totales.cotizaciones, totales.respondidas)}% de las respuestas`}
          barPct={pct(totales.cotizaciones, totales.respondidas)}
          color="bg-emerald-500"
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Campañas activas */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Campañas en curso</h2>
              <Link
                to="/programaciones"
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver todas
              </Link>
            </div>
            {campañasActivas.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay campañas en curso.
              </p>
            ) : (
              <ul className="space-y-4">
                {campañasActivas.map((c) => {
                  const done = c.progreso.sent + c.progreso.failed;
                  const progreso = pct(done, c.progreso.total);
                  return (
                    <li key={c.progId}>
                      <Link
                        to={`/programaciones/${c.progId}`}
                        className="block"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            Programación #{c.progId}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant={campEstadoVariant[c.estado]}>
                              {campEstadoLabel[c.estado]}
                            </Badge>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {done}/{c.progreso.total}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${progreso}%` }}
                          />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Top plantillas por efectividad */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Plantillas más efectivas
              </h2>
              <Link
                to="/plantillas"
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver todas
              </Link>
            </div>
            {topPlantillas.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aún no hay uso registrado de plantillas.
              </p>
            ) : (
              <ul className="space-y-3">
                {topPlantillas.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        #{p.numero} · {p.categoria || 'Sin categoría'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.vecesUsada} usos · {p.cotizacionesObtenidas}{' '}
                        cotizaciones
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-600">
                      {Math.round(p.tasaEfectividad)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estado de dispositivos */}
      <div className="mt-5">
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Dispositivos WhatsApp</h2>
              <Link
                to="/dispositivos"
                className="text-xs font-medium text-primary hover:underline"
              >
                Administrar
              </Link>
            </div>
            {instances.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay dispositivos vinculados.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {instances.map((i) => {
                  const online = i.connectionStatus === 'open';
                  return (
                    <li
                      key={i.name}
                      className="flex items-center gap-3 rounded-xl border p-3"
                    >
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                          online
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        <Smartphone className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {i.profileName || i.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {i.number || 'Sin número'}
                        </p>
                      </div>
                      <span
                        className={`ml-auto inline-flex items-center gap-1.5 text-xs font-medium ${
                          online ? 'text-emerald-600' : 'text-muted-foreground'
                        }`}
                      >
                        <span
                          className={`size-2 rounded-full ${
                            online ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                          }`}
                        />
                        {online
                          ? 'En línea'
                          : i.connectionStatus === 'connecting'
                            ? 'Conectando'
                            : 'Desconectado'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type FunnelCardProps = {
  Icon: LucideIcon;
  label: string;
  value: number;
  sub: string;
  barPct: number;
  color: string;
};

function FunnelCard({ Icon, label, value, sub, barPct, color }: FunnelCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="size-4" />
          {label}
        </div>
        <p className="mt-2 text-3xl font-bold tabular-nums">
          {value.toLocaleString('es-MX')}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${color} transition-all`}
            style={{ width: `${Math.min(barPct, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default DashboardPage;
