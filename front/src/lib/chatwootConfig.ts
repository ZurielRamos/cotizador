import { API_URL, handle } from '@/lib/api';

/**
 * Estado público de la configuración de Chatwoot que devuelve el backend.
 * El token nunca viaja en claro: solo una máscara con los últimos 4 caracteres.
 */
export type PublicChatwootConfig = {
  configured: boolean;
  baseUrl: string | null;
  accountId: string | null;
  tokenMask: string | null;
  actualizadoEn: string | null;
};

export type UpdateChatwootConfigInput = {
  baseUrl: string;
  accountId: string;
  token: string;
};

/** Obtiene el estado público de la configuración de Chatwoot. */
export async function fetchChatwootConfig(): Promise<PublicChatwootConfig> {
  const res = await fetch(`${API_URL}/evolution/chatwoot/config`);
  return handle<PublicChatwootConfig>(res);
}

/** Crea o actualiza la configuración de Chatwoot en el backend. */
export async function saveChatwootConfig(
  input: UpdateChatwootConfigInput,
): Promise<PublicChatwootConfig> {
  const res = await fetch(`${API_URL}/evolution/chatwoot/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handle<PublicChatwootConfig>(res);
}
