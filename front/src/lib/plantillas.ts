import { API_URL, handle } from '@/lib/api';

/** Plantilla tal como la devuelve el backend, con métricas calculadas. */
export type Plantilla = {
  id: string;
  /** Número correlativo automático que identifica la plantilla. */
  numero: number;
  categoria: string;
  cuerpo: string;
  activa: boolean;
  vecesUsada: number;
  ultimoUsoEn: string | null;
  respuestasRecibidas: number;
  cotizacionesObtenidas: number;
  tasaEfectividad: number;
  tasaRespuesta: number;
  creadoEn: string;
  actualizadoEn: string;
};

export type CreatePlantillaInput = {
  /** Único campo obligatorio: el texto de la plantilla. */
  cuerpo: string;
  categoria?: string;
  activa?: boolean;
};

export type UpdatePlantillaInput = Partial<CreatePlantillaInput>;

const BASE = `${API_URL}/plantillas`;

export async function fetchPlantillas(): Promise<Plantilla[]> {
  const res = await fetch(BASE);
  return handle<Plantilla[]>(res);
}

export async function createPlantilla(
  input: CreatePlantillaInput,
): Promise<Plantilla> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handle<Plantilla>(res);
}

export async function updatePlantilla(
  id: string,
  input: UpdatePlantillaInput,
): Promise<Plantilla> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handle<Plantilla>(res);
}

export async function deletePlantilla(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  await handle<void>(res);
}
