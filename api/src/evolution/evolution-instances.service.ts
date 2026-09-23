import {
  BadRequestException,
  BadGatewayException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatwootService } from './chatwoot.service.js';
import { CreateInstanceDto } from './dto/create-instance.dto.js';
import { InstanceLock } from './entities/instance-lock.entity.js';
import { EvolutionService } from './evolution.service.js';

/**
 * Extrae un mensaje de error legible de la respuesta de Evolution API.
 * Evolution anida el detalle útil de varias formas, p. ej.:
 *   { status, error: "Bad Request", response: { message: ["Connection Closed"] } }
 *   { status, error: "Internal Server Error", response: { message: "Connection Closed" } }
 * Preferimos el mensaje anidado (la causa real) sobre el `error` genérico.
 */
function extractEvolutionError(body: unknown, status: number): string {
  const flatten = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) {
      const parts = v.map(flatten).filter(Boolean) as string[];
      return parts.length ? parts.join('; ') : null;
    }
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      // response.message suele traer el detalle real del fallo.
      const nested =
        flatten((o.response as Record<string, unknown>)?.message) ??
        flatten(o.message) ??
        flatten(o.error);
      return nested;
    }
    return null;
  };

  const detail = flatten(body);
  return detail && detail.trim()
    ? detail
    : `Evolution API respondió ${status}`;
}

/** Estado de conexión normalizado. */
export type EstadoConexion = 'open' | 'connecting' | 'close';

/** Instancia normalizada para el frontend. */
export type InstanceView = {
  name: string;
  connectionStatus: EstadoConexion;
  number: string | null;
  profileName: string | null;
  profilePicUrl: string | null;
  updatedAt: string | null;
  /** Fecha de creación de la instancia en Evolution (si la expone). */
  createdAt: string | null;
  /** Bloqueo lógico: si es true, no se permite ninguna acción sobre ella. */
  blocked: boolean;
};

export type CreateInstanceResult = {
  instance: InstanceView;
  /** QR en base64 para vincular (data URL), si Evolution lo devuelve. */
  qrcode: string | null;
  /** Código de emparejamiento alternativo, si aplica. */
  pairingCode: string | null;
  /**
   * Advertencia si la instancia se creó pero la bandeja de Chatwoot no se pudo
   * crear/vincular. Null si no hubo problema o si Chatwoot no está configurado.
   */
  chatwootWarning: string | null;
};

/**
 * Forma mínima de un archivo subido (compatible con Express.Multer.File)
 * que necesitamos para reenviar la imagen a Evolution API.
 */
export type UploadedImage = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

/**
 * Cliente HTTP hacia Evolution API. Usa las credenciales guardadas
 * (baseUrl + apiKey) y normaliza las respuestas.
 */
@Injectable()
export class EvolutionInstancesService {
  constructor(
    private readonly evolutionService: EvolutionService,
    private readonly chatwootService: ChatwootService,
    private readonly config: ConfigService,
    @InjectRepository(InstanceLock)
    private readonly lockRepo: Repository<InstanceLock>,
  ) {}

  /**
   * URL pública del backend donde Evolution enviará los webhooks, o null.
   *
   * La API vive bajo el prefijo global `/api`, así que la ruta real del
   * webhook es `/api/evolution/webhook`. `PUBLIC_API_URL` solo necesita el
   * dominio base (con o sin `/api` al final): se normaliza aquí.
   */
  private webhookUrl(): string | null {
    const base = this.config.get<string>('PUBLIC_API_URL');
    if (!base) return null;
    const trimmed = base.replace(/\/+$/, '');
    const withPrefix = trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
    return `${withPrefix}/evolution/webhook`;
  }

  /** Conjunto de nombres de instancias bloqueadas. */
  private async blockedNames(): Promise<Set<string>> {
    const locks = await this.lockRepo.find();
    return new Set(locks.map((l) => l.instanceName));
  }

  /** ¿Está bloqueada esta instancia? */
  private async isBlocked(name: string): Promise<boolean> {
    const count = await this.lockRepo.countBy({ instanceName: name });
    return count > 0;
  }

  /**
   * Lanza 403 si la instancia está bloqueada. Se usa como candado en todas
   * las operaciones (editar perfil, connect, delete) para que el bloqueo se
   * respete incluso si se llama la API directamente, no solo desde la UI.
   */
  private async ensureNotBlocked(name: string): Promise<void> {
    if (await this.isBlocked(name)) {
      throw new ForbiddenException(
        `La instancia "${name}" está bloqueada. Desbloquéala para operar sobre ella.`,
      );
    }
  }

  /** Bloquea (lógicamente) una instancia. Idempotente. */
  async blockInstance(name: string): Promise<void> {
    if (await this.isBlocked(name)) return;
    await this.lockRepo.save(this.lockRepo.create({ instanceName: name }));
  }

  /** Desbloquea una instancia. Idempotente. */
  async unblockInstance(name: string): Promise<void> {
    await this.lockRepo.delete({ instanceName: name });
  }

  private async credentials(): Promise<{ baseUrl: string; apiKey: string }> {
    const creds = await this.evolutionService.getCredentials();
    if (!creds) {
      throw new BadRequestException(
        'Evolution API no está configurado. Configura la URL y el API Key primero.',
      );
    }
    return creds;
  }

  private async request<T>(
    baseUrl: string,
    apiKey: string,
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
          ...(init?.headers ?? {}),
        },
      });
    } catch (e) {
      throw new BadGatewayException(
        `No se pudo contactar a Evolution API: ${
          e instanceof Error ? e.message : 'error de red'
        }`,
      );
    }

    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Respuesta no-JSON: conservar el texto crudo para el mensaje de error.
      body = text || null;
    }

    if (!res.ok) {
      throw new BadGatewayException(extractEvolutionError(body, res.status));
    }

    return body as T;
  }

  private normalizeStatus(raw: unknown): EstadoConexion {
    if (raw === 'open' || raw === 'connecting' || raw === 'close') {
      return raw;
    }
    return 'close';
  }

  /** Extrae el número del ownerJid (formato 5215512345678@s.whatsapp.net). */
  private numberFromJid(jid: unknown): string | null {
    if (typeof jid !== 'string' || !jid.includes('@')) return null;
    return `+${jid.split('@')[0]}`;
  }

  /**
   * Lista instancias. Evolution v2 devuelve un array de objetos;
   * algunas versiones anidan los datos en `instance`.
   */
  async listInstances(): Promise<InstanceView[]> {
    const { baseUrl, apiKey } = await this.credentials();
    const data = await this.request<unknown>(
      baseUrl,
      apiKey,
      '/instance/fetchInstances',
    );

    const blocked = await this.blockedNames();
    const arr = Array.isArray(data) ? data : [];
    return arr.map((item) => {
      const record = item as Record<string, unknown>;
      // v2 devuelve campos planos; algunas versiones usan { instance: {...} }.
      const inst = (record.instance as Record<string, unknown>) ?? record;

      const name =
        (inst.name as string) ??
        (inst.instanceName as string) ??
        (record.name as string) ??
        '';

      return {
        name,
        connectionStatus: this.normalizeStatus(
          inst.connectionStatus ?? inst.status ?? record.connectionStatus,
        ),
        number:
          this.numberFromJid(inst.ownerJid ?? record.ownerJid) ??
          ((inst.number as string) || null),
        profileName:
          (inst.profileName as string) ??
          (record.profileName as string) ??
          null,
        profilePicUrl:
          (inst.profilePicUrl as string) ??
          (record.profilePicUrl as string) ??
          null,
        updatedAt:
          (inst.updatedAt as string) ?? (record.updatedAt as string) ?? null,
        createdAt:
          (inst.createdAt as string) ?? (record.createdAt as string) ?? null,
        blocked: blocked.has(name),
      };
    });
  }

  /** Crea una nueva instancia y devuelve el QR para vincular. */
  async createInstance(dto: CreateInstanceDto): Promise<CreateInstanceResult> {
    const { baseUrl, apiKey } = await this.credentials();

    const payload: Record<string, unknown> = {
      instanceName: dto.instanceName,
      integration: dto.integration ?? 'WHATSAPP-BAILEYS',
      qrcode: true,
    };

    const data = await this.request<Record<string, unknown>>(
      baseUrl,
      apiKey,
      '/instance/create',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    const inst = (data.instance as Record<string, unknown>) ?? data;
    const qr = data.qrcode as Record<string, unknown> | undefined;
    const name =
      (inst.instanceName as string) ??
      (inst.name as string) ??
      dto.instanceName;

    // Registrar el webhook para recibir eventos (conexión, entrega, respuestas)
    // que alimentan la reputación. No bloqueante.
    const url = this.webhookUrl();
    if (url) {
      try {
        await this.setWebhook(name, url);
      } catch {
        // El webhook se puede reintentar luego; no abortamos la creación.
      }
    }

    // Si Chatwoot está configurado, crear/vincular su bandeja de inmediato.
    // No bloqueamos la creación de la instancia si esto falla: solo advertimos.
    let chatwootWarning: string | null = null;
    const chatwoot = await this.chatwootService.getCredentials();
    if (chatwoot) {
      try {
        await this.setChatwoot(name, chatwoot);
      } catch (e) {
        chatwootWarning =
          e instanceof Error
            ? `La instancia se creó, pero no se pudo crear la bandeja de Chatwoot: ${e.message}`
            : 'La instancia se creó, pero no se pudo crear la bandeja de Chatwoot.';
      }
    }

    return {
      instance: {
        name,
        connectionStatus: this.normalizeStatus(
          inst.status ?? inst.connectionStatus,
        ),
        number: null,
        profileName: null,
        profilePicUrl: null,
        updatedAt: null,
        createdAt: null,
        blocked: false,
      },
      qrcode: (qr?.base64 as string) ?? null,
      pairingCode: (qr?.pairingCode as string) ?? null,
      chatwootWarning,
    };
  }

  /**
   * Registra el webhook de una instancia usando la URL pública configurada.
   * Devuelve true si se registró, false si no hay PUBLIC_API_URL o falló.
   */
  async ensureWebhook(name: string): Promise<boolean> {
    const url = this.webhookUrl();
    if (!url) return false;
    try {
      await this.setWebhook(name, url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Registra la URL de webhook en Evolution para una instancia, suscribiendo
   * los eventos que alimentan la reputación. Idempotente.
   */
  private async setWebhook(name: string, url: string): Promise<void> {
    const { baseUrl, apiKey } = await this.credentials();
    await this.request<unknown>(
      baseUrl,
      apiKey,
      `/webhook/set/${encodeURIComponent(name)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url,
            // Un evento por request para poder identificar el tipo fácilmente.
            byEvents: false,
            base64: false,
            events: [
              'CONNECTION_UPDATE',
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE',
            ],
          },
        }),
      },
    );
  }

  /**
   * Crea/vincula la bandeja (inbox) de Chatwoot para una instancia mediante
   * POST /chatwoot/set/{instance}. Idempotente: si ya existe, actualiza config.
   */
  private async setChatwoot(
    name: string,
    chatwoot: { baseUrl: string; accountId: string; token: string },
  ): Promise<void> {
    const { baseUrl, apiKey } = await this.credentials();
    await this.request<unknown>(
      baseUrl,
      apiKey,
      `/chatwoot/set/${encodeURIComponent(name)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          enabled: true,
          accountId: chatwoot.accountId,
          token: chatwoot.token,
          url: chatwoot.baseUrl,
          signMsg: true,
          reopenConversation: true,
          conversationPending: false,
          nameInbox: name,
          importContacts: false,
          importMessages: false,
          autoCreate: true,
        }),
      },
    );
  }

  /** Obtiene un nuevo QR para reconectar/vincular una instancia existente. */
  async connectInstance(
    name: string,
  ): Promise<{ qrcode: string | null; pairingCode: string | null }> {
    await this.ensureNotBlocked(name);
    const { baseUrl, apiKey } = await this.credentials();
    const data = await this.request<Record<string, unknown>>(
      baseUrl,
      apiKey,
      `/instance/connect/${encodeURIComponent(name)}`,
    );
    return {
      qrcode: (data.base64 as string) ?? null,
      pairingCode: (data.pairingCode as string) ?? null,
    };
  }

  /**
   * Envía un mensaje de texto por la instancia (POST /message/sendText/:name).
   * `number` en formato internacional sin +, o el JID completo. Lanza si la
   * instancia está bloqueada o si Evolution responde error.
   */
  async sendText(
    instanceName: string,
    to: string,
    text: string,
  ): Promise<void> {
    await this.ensureNotBlocked(instanceName);
    const { baseUrl, apiKey } = await this.credentials();
    await this.request<unknown>(
      baseUrl,
      apiKey,
      `/message/sendText/${encodeURIComponent(instanceName)}`,
      {
        method: 'POST',
        body: JSON.stringify({ number: to, text }),
      },
    );
  }

  /** Cambia el nombre del perfil de WhatsApp de la instancia. */
  async updateProfileName(name: string, profileName: string): Promise<void> {
    await this.ensureNotBlocked(name);
    const { baseUrl, apiKey } = await this.credentials();
    await this.request<unknown>(
      baseUrl,
      apiKey,
      `/chat/updateProfileName/${encodeURIComponent(name)}`,
      {
        method: 'POST',
        body: JSON.stringify({ name: profileName }),
      },
    );
  }

  /** Cambia el mensaje de estado/recado del perfil de WhatsApp. */
  async updateProfileStatus(name: string, status: string): Promise<void> {
    await this.ensureNotBlocked(name);
    const { baseUrl, apiKey } = await this.credentials();
    await this.request<unknown>(
      baseUrl,
      apiKey,
      `/chat/updateProfileStatus/${encodeURIComponent(name)}`,
      {
        method: 'POST',
        body: JSON.stringify({ status }),
      },
    );
  }

  /**
   * Cambia la foto de perfil enviando la imagen como multipart/form-data.
   * No reutiliza request() porque ese helper fuerza JSON; aquí dejamos que
   * fetch construya el boundary del multipart automáticamente.
   */
  async updateProfilePicture(
    name: string,
    file: UploadedImage,
  ): Promise<void> {
    await this.ensureNotBlocked(name);
    const { baseUrl, apiKey } = await this.credentials();
    const url = `${baseUrl.replace(/\/$/, '')}/chat/updateProfilePicture/${encodeURIComponent(
      name,
    )}`;

    const form = new FormData();
    // Uint8Array.from copia los bytes a un ArrayBuffer propio, produciendo un
    // Uint8Array<ArrayBuffer> que sí es un BlobPart válido (evita la unión con
    // SharedArrayBuffer que trae Buffer<ArrayBufferLike>).
    const bytes = Uint8Array.from(file.buffer);
    const blob = new Blob([bytes], {
      type: file.mimetype || 'application/octet-stream',
    });
    form.append('file', blob, file.originalname || 'profile');

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { apikey: apiKey },
        body: form,
      });
    } catch (e) {
      throw new BadGatewayException(
        `No se pudo contactar a Evolution API: ${
          e instanceof Error ? e.message : 'error de red'
        }`,
      );
    }

    if (!res.ok) {
      const text = await res.text();
      let message: unknown = `Evolution API respondió ${res.status}`;
      try {
        const body = text ? JSON.parse(text) : null;
        message =
          (body as { message?: unknown; error?: unknown })?.message ??
          (body as { error?: unknown })?.error ??
          message;
      } catch {
        // respuesta sin cuerpo JSON
      }
      throw new BadGatewayException(
        typeof message === 'string' ? message : JSON.stringify(message),
      );
    }
  }

  /**
   * Elimina la instancia en Evolution API (DELETE /instance/delete/:name).
   * Bloqueada por ensureNotBlocked. Si tenía un lock, se limpia por si acaso.
   */
  async deleteInstance(name: string): Promise<void> {
    await this.ensureNotBlocked(name);
    const { baseUrl, apiKey } = await this.credentials();
    await this.request<unknown>(
      baseUrl,
      apiKey,
      `/instance/delete/${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    );
    // Limpieza defensiva de cualquier lock huérfano.
    await this.lockRepo.delete({ instanceName: name });
  }
}
