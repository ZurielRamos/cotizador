import { API_URL, handle } from '@/lib/api';

export type EstadoConexion = 'open' | 'connecting' | 'close';

export type Instance = {
  name: string;
  connectionStatus: EstadoConexion;
  number: string | null;
  profileName: string | null;
  profilePicUrl: string | null;
  updatedAt: string | null;
  /** Bloqueo lógico: si es true, no se permite ninguna acción sobre ella. */
  blocked: boolean;
};

export type CreateInstanceResult = {
  instance: Instance;
  qrcode: string | null;
  pairingCode: string | null;
  /** Advertencia si la bandeja de Chatwoot no se pudo crear (instancia sí). */
  chatwootWarning: string | null;
};

export type ConnectResult = {
  qrcode: string | null;
  pairingCode: string | null;
};

/** Lista las instancias reales desde Evolution API (vía backend). */
export async function fetchInstances(): Promise<Instance[]> {
  const res = await fetch(`${API_URL}/evolution/instances`);
  return handle<Instance[]>(res);
}

/** Crea una nueva instancia y devuelve el QR para vincular. */
export async function createInstance(
  instanceName: string,
): Promise<CreateInstanceResult> {
  const res = await fetch(`${API_URL}/evolution/instances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instanceName }),
  });
  return handle<CreateInstanceResult>(res);
}

/** Obtiene un nuevo QR para vincular/reconectar una instancia. */
export async function connectInstance(name: string): Promise<ConnectResult> {
  const res = await fetch(
    `${API_URL}/evolution/instances/${encodeURIComponent(name)}/connect`,
  );
  return handle<ConnectResult>(res);
}

/** Cambia el nombre del perfil de WhatsApp de una instancia. */
export async function updateProfileName(
  name: string,
  profileName: string,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/evolution/instances/${encodeURIComponent(name)}/profile/name`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: profileName }),
    },
  );
  await handle<void>(res);
}

/** Cambia el mensaje de estado/recado del perfil de WhatsApp. */
export async function updateProfileStatus(
  name: string,
  status: string,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/evolution/instances/${encodeURIComponent(name)}/profile/status`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  );
  await handle<void>(res);
}

/**
 * Cambia la foto de perfil enviando el archivo como multipart/form-data.
 * No fijamos Content-Type: el navegador añade el boundary automáticamente.
 */
export async function updateProfilePicture(
  name: string,
  file: File,
): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(
    `${API_URL}/evolution/instances/${encodeURIComponent(name)}/profile/picture`,
    {
      method: 'POST',
      body: form,
    },
  );
  await handle<void>(res);
}

/** Bloquea (lógicamente) una instancia: congela todas las operaciones. */
export async function blockInstance(name: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/evolution/instances/${encodeURIComponent(name)}/block`,
    { method: 'POST' },
  );
  await handle<void>(res);
}

/** Desbloquea una instancia. */
export async function unblockInstance(name: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/evolution/instances/${encodeURIComponent(name)}/block`,
    { method: 'DELETE' },
  );
  await handle<void>(res);
}

/** Elimina la instancia en Evolution API. */
export async function deleteInstance(name: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/evolution/instances/${encodeURIComponent(name)}`,
    { method: 'DELETE' },
  );
  await handle<void>(res);
}
