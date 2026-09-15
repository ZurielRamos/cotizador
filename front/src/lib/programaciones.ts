import { API_URL, handle } from '@/lib/api';

/** Depósito de un municipio dentro de una programación. */
export type ProgramacionDeposito = {
  id: string;
  depositoId: string;
  idDeposito: string | null;
  nombre: string | null;
  telefono: string | null;
  telefono2: string | null;
  direccion: string | null;
};

/** Municipio dentro de una programación. */
export type ProgramacionMunicipio = {
  id: string;
  municipioId: number;
  municipio: string;
  departamento: string;
  requerido: number;
  objetivoTriple: number;
  depositosDevueltos: number;
  depositos: ProgramacionDeposito[];
};

/** Programación tal como la devuelve el backend en el listado. */
export type Programacion = {
  id: number;
  fechaInicio: string;
  fechaFin: string;
  creadoEn: string;
  actualizadoEn: string;
};

/** Programación con su detalle completo (municipios + depósitos). */
export type ProgramacionDetalle = Programacion & {
  municipios: ProgramacionMunicipio[];
};

/** Respuesta del endpoint de carga. */
export type CargarProgramacionResult = {
  yaCargada: boolean;
  mensaje: string;
  programacion: {
    id: number;
    fechaInicio: string;
    fechaFin: string;
  };
};

const BASE = `${API_URL}/programaciones`;

/**
 * Dispara la carga de la programación desde el endpoint externo.
 * Si la programación ya estaba cargada, `yaCargada` viene en `true`.
 */
export async function cargarProgramacion(): Promise<CargarProgramacionResult> {
  const res = await fetch(`${BASE}/cargar`, { method: 'POST' });
  return handle<CargarProgramacionResult>(res);
}

export async function fetchProgramaciones(): Promise<Programacion[]> {
  const res = await fetch(BASE);
  return handle<Programacion[]>(res);
}

export async function fetchProgramacion(
  id: number,
): Promise<ProgramacionDetalle> {
  const res = await fetch(`${BASE}/${id}`);
  return handle<ProgramacionDetalle>(res);
}
