export const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Maneja una respuesta fetch: lanza Error con el mensaje del backend cuando
 * el status no es OK, o parsea el JSON en caso de éxito.
 */
export async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body?.message) {
        message = Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message;
      }
    } catch {
      // respuesta sin cuerpo JSON
    }
    throw new Error(message);
  }
  // 204 No Content u otras respuestas sin cuerpo.
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}
