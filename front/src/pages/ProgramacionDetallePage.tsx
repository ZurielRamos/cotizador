import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  Send,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ProgramacionCampaignPanel from '@/components/ProgramacionCampaignPanel';
import {
  enviarMunicipioCampania,
  fetchMunicipiosEstado,
  fetchProgramacionMunicipios,
  fetchProgramacionTargets,
  marcarCotizacion,
  type MunicipiosEstado,
  type MunicipiosResumen,
  type TargetByNumero,
} from '@/lib/campanias';
import {
  fetchChatwootConfig,
  type PublicChatwootConfig,
} from '@/lib/chatwootConfig';
import { AccordionItem } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  fetchProgramacion,
  type ProgramacionDetalle,
  type ProgramacionMunicipio,
} from '@/lib/programaciones';

/** Normaliza un teléfono a solo dígitos (para casar con los targets). */
function soloDigitos(tel: string | null): string {
  return (tel ?? '').replace(/\D/g, '');
}

/** Agrupa municipios por departamento y calcula totales por departamento. */
type Departamento = {
  nombre: string;
  municipios: ProgramacionMunicipio[];
  totalMunicipios: number;
  totalDepositos: number;
  requerido: number;
  objetivoTriple: number;
  depositosDevueltos: number;
};

function agruparPorDepartamento(
  municipios: ProgramacionMunicipio[],
): Departamento[] {
  const map = new Map<string, Departamento>();
  for (const m of municipios) {
    const key = m.departamento || '—';
    let dep = map.get(key);
    if (!dep) {
      dep = {
        nombre: key,
        municipios: [],
        totalMunicipios: 0,
        totalDepositos: 0,
        requerido: 0,
        objetivoTriple: 0,
        depositosDevueltos: 0,
      };
      map.set(key, dep);
    }
    dep.municipios.push(m);
    dep.totalMunicipios += 1;
    dep.totalDepositos += m.depositos.length;
    dep.requerido += m.requerido;
    dep.objetivoTriple += m.objetivoTriple;
    dep.depositosDevueltos += m.depositosDevueltos;
  }
  return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** URL de una conversación en Chatwoot, o null si falta config. */
function chatwootConvUrl(
  cfg: PublicChatwootConfig | null,
  conversationId: number | null | undefined,
): string | null {
  if (!cfg?.baseUrl || !cfg.accountId || conversationId == null) return null;
  const base = cfg.baseUrl.replace(/\/+$/, '');
  return `${base}/app/accounts/${cfg.accountId}/conversations/${conversationId}`;
}

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

function ProgramacionDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [programacion, setProgramacion] = useState<ProgramacionDetalle | null>(
    null,
  );
  const [targets, setTargets] = useState<TargetByNumero>({});
  const [municipios, setMunicipios] = useState<MunicipiosResumen>({});
  const [muniEstado, setMuniEstado] = useState<MunicipiosEstado>({});
  const [enviandoMuni, setEnviandoMuni] = useState<string | null>(null);
  const [chatwoot, setChatwoot] = useState<PublicChatwootConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchProgramacion(Number(id))
      .then(setProgramacion)
      .catch((e: unknown) =>
        setError(
          e instanceof Error
            ? `No se pudo cargar la programación: ${e.message}`
            : 'No se pudo cargar la programación.',
        ),
      )
      .finally(() => setLoading(false));
    // Estado por número de la campaña (complementario, no bloquea la vista).
    fetchProgramacionTargets(Number(id))
      .then(setTargets)
      .catch(() => setTargets({}));
    // Resumen por municipio (cotizaciones/requerido, meta cumplida).
    fetchProgramacionMunicipios(Number(id))
      .then(setMunicipios)
      .catch(() => setMunicipios({}));
    // Estado de ejecución por municipio (pendiente/en curso/ejecutado).
    fetchMunicipiosEstado(Number(id))
      .then(setMuniEstado)
      .catch(() => setMuniEstado({}));
    // Config de Chatwoot para construir los enlaces a las conversaciones.
    fetchChatwootConfig()
      .then(setChatwoot)
      .catch(() => setChatwoot(null));
  }, [id]);

  /** Marca/desmarca cotización de un depósito (por teléfono). */
  const toggleCotizacion = async (telefono: string | null, valor: boolean) => {
    if (!id) return;
    const numero = soloDigitos(telefono);
    if (!numero) return;
    // Optimista: refleja el cambio en la tabla de inmediato.
    setTargets((prev) => {
      const t = prev[numero];
      if (!t) return prev;
      return { ...prev, [numero]: { ...t, cotizacion: valor } };
    });
    try {
      await marcarCotizacion(Number(id), numero, valor);
      // Recalcular metas por municipio tras el cambio.
      const resumen = await fetchProgramacionMunicipios(Number(id));
      setMunicipios(resumen);
    } catch {
      // Si falla, revertir consultando de nuevo el estado real.
      fetchProgramacionTargets(Number(id))
        .then(setTargets)
        .catch(() => {});
    }
  };

  /** Envía la campaña de un municipio y refresca su estado. */
  const enviarMunicipio = async (municipio: string) => {
    if (!id) return;
    setEnviandoMuni(municipio);
    setError(null);
    try {
      await enviarMunicipioCampania(Number(id), municipio);
      const estado = await fetchMunicipiosEstado(Number(id));
      setMuniEstado(estado);
    } catch (e) {
      setError(
        e instanceof Error
          ? `No se pudo enviar el municipio: ${e.message}`
          : 'No se pudo enviar el municipio.',
      );
    } finally {
      setEnviandoMuni(null);
    }
  };

  useEffect(() => {
    cargar();
  }, [cargar]);

  const totalMunicipios = programacion?.municipios.length ?? 0;
  const totalDepositos =
    programacion?.municipios.reduce(
      (acc, m) => acc + m.depositos.length,
      0,
    ) ?? 0;

  return (
    <div>
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2"
          onClick={() => navigate('/programaciones')}
        >
          <ArrowLeft className="size-4" />
          Volver a programaciones
        </Button>

        {programacion ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">
                Programación #{programacion.id}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatFecha(programacion.fechaInicio)} —{' '}
                {formatFecha(programacion.fechaFin)}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="executed">{totalMunicipios} municipios</Badge>
              <Badge variant="executed">{totalDepositos} depósitos</Badge>
            </div>
          </div>
        ) : (
          <h1 className="text-2xl font-bold">Programación</h1>
        )}
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Cargando detalle…
        </div>
      ) : !programacion ? null : (
        <>
          <ProgramacionCampaignPanel programacionId={programacion.id} />

          {programacion.municipios.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Esta programación no tiene municipios.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {agruparPorDepartamento(programacion.municipios).map((dep) => (
                <AccordionItem
                  key={dep.nombre}
                  header={
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 text-muted-foreground" />
                        <span className="font-semibold">{dep.nombre}</span>
                        <Badge variant="executed">
                          {dep.totalMunicipios} municipios
                        </Badge>
                        <Badge variant="executed">
                          {dep.totalDepositos} depósitos
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Requerido: {dep.requerido}</span>
                        <span>Objetivo triple: {dep.objetivoTriple}</span>
                        <span>Devueltos: {dep.depositosDevueltos}</span>
                      </div>
                    </div>
                  }
                >
                  <div className="flex flex-col gap-3">
                    {dep.municipios.map((m) => (
                      <AccordionItem
                        key={m.id}
                        className="bg-muted/30"
                        header={
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {m.municipio}
                              </span>
                              <Badge variant="executed">
                                {m.depositos.length} depósitos
                              </Badge>
                              {(() => {
                                const est = muniEstado[m.municipio];
                                if (!est) return null;
                                if (est.estado === 'ejecutado') {
                                  return (
                                    <Badge variant="active">
                                      Ejecutado {est.enviados}/{est.total}
                                    </Badge>
                                  );
                                }
                                if (est.estado === 'en_curso') {
                                  return (
                                    <Badge variant="default">
                                      Enviando {est.enviados}/{est.total}
                                    </Badge>
                                  );
                                }
                                if (est.estado === 'con_fallos') {
                                  return (
                                    <Badge variant="destructive">
                                      {est.fallidos} fallidos
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                              {(() => {
                                // Badge extra de fallidos cuando el municipio se
                                // ejecutó pero algunos envíos fallaron.
                                const est = muniEstado[m.municipio];
                                if (
                                  est?.estado === 'ejecutado' &&
                                  est.fallidos > 0
                                ) {
                                  return (
                                    <Badge variant="destructive">
                                      {est.fallidos} fallidos
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                              {(() => {
                                const r = municipios[m.municipio];
                                if (!r) return null;
                                return r.metaCumplida ? (
                                  <Badge variant="active">
                                    Meta cumplida {r.cotizaciones}/{r.requerido}
                                  </Badge>
                                ) : (
                                  <Badge variant="default">
                                    Cotizaciones {r.cotizaciones}/{r.requerido}
                                  </Badge>
                                );
                              })()}
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <span>Requerido: {m.requerido}</span>
                                <span>Objetivo triple: {m.objetivoTriple}</span>
                                <span>Devueltos: {m.depositosDevueltos}</span>
                              </div>
                              {(() => {
                                const est = muniEstado[m.municipio];
                                const enviando = enviandoMuni === m.municipio;
                                const enCurso = est?.estado === 'en_curso';
                                const conFallos = est?.estado === 'con_fallos';
                                const ejecutadoOk =
                                  est?.estado === 'ejecutado';
                                const tieneFallos = (est?.fallidos ?? 0) > 0;

                                // Ejecutado sin fallos: nada que reenviar.
                                if (ejecutadoOk && !tieneFallos) {
                                  return (
                                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                                      <CheckCircle2 className="size-4" />
                                      Ejecutado
                                    </span>
                                  );
                                }

                                // En curso: botón deshabilitado.
                                if (enCurso) {
                                  return (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled
                                    >
                                      <Loader2 className="size-4 animate-spin" />
                                      En curso
                                    </Button>
                                  );
                                }

                                // con_fallos, o ejecutado con fallos → reintentar.
                                // pendiente/sin estado → enviar por primera vez.
                                const esReintento = conFallos || ejecutadoOk;
                                return (
                                  <div className="flex items-center gap-2">
                                    {ejecutadoOk ? (
                                      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                                        <CheckCircle2 className="size-4" />
                                        {est?.enviados}/{est?.total}
                                      </span>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant={esReintento ? 'outline' : 'default'}
                                      disabled={enviando}
                                      // Evita que el click abra/cierre el acordeón.
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void enviarMunicipio(m.municipio);
                                      }}
                                    >
                                      {enviando ? (
                                        <Loader2 className="size-4 animate-spin" />
                                      ) : (
                                        <Send className="size-4" />
                                      )}
                                      {esReintento
                                        ? 'Reintentar fallidos'
                                        : 'Enviar municipio'}
                                    </Button>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        }
                      >
                  {m.depositos.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      Sin depósitos para este municipio.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>ID Depósito</TableHead>
                          <TableHead>Teléfono</TableHead>
                          <TableHead>Chatwoot</TableHead>
                          <TableHead>Respondió</TableHead>
                          <TableHead>Cotización</TableHead>
                          <TableHead>Dirección</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {m.depositos.map((d) => {
                          const t = targets[soloDigitos(d.telefono)];
                          return (
                          <TableRow key={d.id}>
                            <TableCell className="font-medium">
                              {d.nombre ?? '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {d.idDeposito ?? '—'}
                            </TableCell>
                            <TableCell>
                              {d.telefono ? (
                                <span className="flex items-center gap-1.5">
                                  <Phone className="size-3.5 text-muted-foreground" />
                                  {d.telefono}
                                </span>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const url = chatwootConvUrl(
                                  chatwoot,
                                  t?.chatwootConversationId,
                                );
                                if (t?.chatwootConversationId == null) {
                                  return (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  );
                                }
                                if (!url) {
                                  return (
                                    <span className="flex items-center gap-1.5 text-muted-foreground">
                                      <MessageSquare className="size-3.5" />#
                                      {t.chatwootConversationId}
                                    </span>
                                  );
                                }
                                return (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                                  >
                                    <MessageSquare className="size-3.5" />
                                    Abrir #{t.chatwootConversationId}
                                    <ExternalLink className="size-3" />
                                  </a>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              {t?.respondido ? (
                                <span className="flex items-center gap-1 text-emerald-600">
                                  <Check className="size-4" />
                                  Sí
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="size-4"
                                  checked={t?.cotizacion ?? false}
                                  disabled={!t}
                                  onChange={(e) =>
                                    toggleCotizacion(
                                      d.telefono,
                                      e.target.checked,
                                    )
                                  }
                                />
                                {t?.cotizacion ? 'Sí' : ''}
                              </label>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {d.direccion ?? '—'}
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                      </AccordionItem>
                    ))}
                  </div>
                </AccordionItem>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ProgramacionDetallePage;
