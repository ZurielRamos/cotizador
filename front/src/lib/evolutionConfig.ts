import { API_URL, handle } from '@/lib/api';

/**
 * Estado público de la configuración de Evolution API que devuelve el backend.
 * El apiKey nunca viaja en claro: solo una máscara con los últimos 4 caracteres.
 */
export type PublicEvolutionConfig = {
  configured: boolean;
  baseUrl: string | null;
  apiKeyMask: string | null;
  actualizadoEn: string | null;
};

export type UpdateEvolutionConfigInput = {
  baseUrl: string;
  apiKey: string;
};

/** Obtiene el estado público de la configuración desde el backend. */
export async function fetchEvolutionConfig(): Promise<PublicEvolutionConfig> {
  const res = await fetch(`${API_URL}/evolution/config`);
  return handle<PublicEvolutionConfig>(res);
}

/** Crea o actualiza la configuración en el backend. */
export async function saveEvolutionConfig(
  input: UpdateEvolutionConfigInput,
): Promise<PublicEvolutionConfig> {
  const res = await fetch(`${API_URL}/evolution/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handle<PublicEvolutionConfig>(res);
}
