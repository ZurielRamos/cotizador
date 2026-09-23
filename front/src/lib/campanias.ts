import { API_URL, handle } from '@/lib/api';

export type CampaignStatus =
  | 'draft'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type CampaignProgress = {
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  respondidas: number;
};

export type Campaign = {
  id: string;
  nombre: string;
  estado: CampaignStatus;
  plantillaIds: string[];
  creadoEn: string;
  actualizadoEn: string;
  progreso: CampaignProgress;
};

/** Resumen de la campaña de una programación (cálculos + campaña si existe). */
export type ProgramacionCampaignSummary = {
  numerosDisponibles: number;
  plantillasActivas: number;
  dispositivosConectados: number;
  dispositivosDisponibles: number;
  capacidadDiaria: number;
  diasEstimados: number | null;
  campaign: Campaign | null;
};

/** Estado por número de la campaña de una programación (para casar con depósitos). */
export type TargetByNumero = Record<
  string,
  {
    estado: string;
    chatwootConversationId: number | null;
    respondido: boolean;
    cotizacion: boolean;
  }
>;

export async function fetchProgramacionTargets(
  progId: number,
): Promise<TargetByNumero> {
  const res = await fetch(
    `${API_URL}/campanias/programacion/${progId}/targets`,
  );
  return handle<TargetByNumero>(res);
}

/** Resumen por municipio: { [municipio]: { requerido, cotizaciones, metaCumplida } }. */
export type MunicipiosResumen = Record<
  string,
  { requerido: number; cotizaciones: number; metaCumplida: boolean }
>;

export async function fetchProgramacionMunicipios(
  progId: number,
): Promise<MunicipiosResumen> {
  const res = await fetch(
    `${API_URL}/campanias/programacion/${progId}/municipios`,
  );
  return handle<MunicipiosResumen>(res);
}

/** Estado de ejecución de un municipio dentro de la campaña. */
export type EstadoMunicipio =
  | 'pendiente'
  | 'en_curso'
  | 'con_fallos'
  | 'ejecutado';

/** Estado + métricas por municipio: { [municipio]: {...} }. */
export type MunicipiosEstado = Record<
  string,
  {
    estado: EstadoMunicipio;
    total: number;
    enviados: number;
    pendientes: number;
    fallidos: number;
    requerido: number;
    cotizaciones: number;
    metaCumplida: boolean;
  }
>;

/** Estado de ejecución por municipio (pendiente/en curso/ejecutado). */
export async function fetchMunicipiosEstado(
  progId: number,
): Promise<MunicipiosEstado> {
  const res = await fetch(
    `${API_URL}/campanias/programacion/${progId}/municipios/estado`,
  );
  return handle<MunicipiosEstado>(res);
}

/** Envía (encola) la campaña de un municipio concreto de la programación. */
export async function enviarMunicipioCampania(
  progId: number,
  municipio: string,
): Promise<Campaign> {
  const res = await fetch(
    `${API_URL}/campanias/programacion/${progId}/municipio`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ municipio }),
    },
  );
  return handle<Campaign>(res);
}

/** Marca/desmarca la cotización de un destinatario (por número). */
export async function marcarCotizacion(
  progId: number,
  numero: string,
  cotizacion: boolean,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/campanias/programacion/${progId}/cotizacion`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero, cotizacion }),
    },
  );
  await handle<void>(res);
}

/** Resumen ligero de campaña por programación: { [progId]: {...} }. */
export type CampaignByProgramacion = Record<
  number,
  { estado: CampaignStatus; progreso: CampaignProgress }
>;

/** Estado + progreso de la campaña de cada programación (mapa por id). */
export async function fetchCampaignsByProgramacion(): Promise<CampaignByProgramacion> {
  const res = await fetch(`${API_URL}/campanias/programaciones/resumen`);
  return handle<CampaignByProgramacion>(res);
}

/** Resumen de la campaña asociada a una programación. */
export async function fetchProgramacionCampaign(
  progId: number,
): Promise<ProgramacionCampaignSummary> {
  const res = await fetch(`${API_URL}/campanias/programacion/${progId}`);
  return handle<ProgramacionCampaignSummary>(res);
}

/** Crea e inicia la campaña de una programación. */
export async function iniciarProgramacionCampaign(
  progId: number,
): Promise<Campaign> {
  const res = await fetch(`${API_URL}/campanias/programacion/${progId}`, {
    method: 'POST',
  });
  return handle<Campaign>(res);
}

async function transition(id: string, action: string): Promise<Campaign> {
  const res = await fetch(
    `${API_URL}/campanias/${encodeURIComponent(id)}/${action}`,
    { method: 'POST' },
  );
  return handle<Campaign>(res);
}

export const startCampania = (id: string) => transition(id, 'start');
export const pauseCampania = (id: string) => transition(id, 'pause');
export const cancelCampania = (id: string) => transition(id, 'cancel');
