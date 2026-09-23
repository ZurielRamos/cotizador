import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { decrypt, encrypt } from '../common/crypto.util.js';
import { UpdateChatwootConfigDto } from './dto/update-chatwoot-config.dto.js';
import { ChatwootConfig } from './entities/chatwoot-config.entity.js';

/** Vista pública: nunca incluye el token en claro. */
export type PublicChatwootConfig = {
  configured: boolean;
  baseUrl: string | null;
  accountId: string | null;
  tokenMask: string | null;
  actualizadoEn: Date | null;
};

/** Credenciales descifradas para uso interno del backend. */
export type ChatwootCredentials = {
  baseUrl: string;
  accountId: string;
  token: string;
};

@Injectable()
export class ChatwootService {
  /** Cache en memoria de inbox_id por nombre de instancia. */
  private readonly inboxCache = new Map<string, number | null>();

  constructor(
    @InjectRepository(ChatwootConfig)
    private readonly repo: Repository<ChatwootConfig>,
    private readonly config: ConfigService,
  ) {}

  private get encryptionSecret(): string {
    return this.config.get<string>('APP_ENCRYPTION_KEY', 'change-me-in-env');
  }

  /** Normaliza la URL quitando la barra final (Chatwoot lo exige). */
  private normalizeUrl(url: string): string {
    return url.replace(/\/+$/, '');
  }

  private async findRecord(): Promise<ChatwootConfig | null> {
    return this.repo.findOne({ where: {}, order: { creadoEn: 'ASC' } });
  }

  async getPublicConfig(): Promise<PublicChatwootConfig> {
    const record = await this.findRecord();
    if (!record) {
      return {
        configured: false,
        baseUrl: null,
        accountId: null,
        tokenMask: null,
        actualizadoEn: null,
      };
    }
    return {
      configured: true,
      baseUrl: record.baseUrl,
      accountId: record.accountId,
      tokenMask: `••••••••${record.tokenLast4}`,
      actualizadoEn: record.actualizadoEn,
    };
  }

  async upsert(dto: UpdateChatwootConfigDto): Promise<PublicChatwootConfig> {
    const tokenEncrypted = encrypt(dto.token, this.encryptionSecret);
    const tokenLast4 = dto.token.slice(-4);
    const baseUrl = this.normalizeUrl(dto.baseUrl);

    let record = await this.findRecord();
    if (record) {
      record.baseUrl = baseUrl;
      record.accountId = dto.accountId;
      record.tokenEncrypted = tokenEncrypted;
      record.tokenLast4 = tokenLast4;
    } else {
      record = this.repo.create({
        baseUrl,
        accountId: dto.accountId,
        tokenEncrypted,
        tokenLast4,
      });
    }

    await this.repo.save(record);
    return this.getPublicConfig();
  }

  /**
   * Credenciales descifradas para uso interno (crear inbox al crear instancia).
   * Devuelve null si Chatwoot no está configurado.
   */
  async getCredentials(): Promise<ChatwootCredentials | null> {
    const record = await this.findRecord();
    if (!record) return null;
    return {
      baseUrl: record.baseUrl,
      accountId: record.accountId,
      token: decrypt(record.tokenEncrypted, this.encryptionSecret),
    };
  }

  /** Petición autenticada a la API de Chatwoot. Devuelve null ante error. */
  private async apiGet<T>(
    creds: ChatwootCredentials,
    path: string,
  ): Promise<T | null> {
    try {
      const res = await fetch(`${creds.baseUrl}${path}`, {
        headers: { api_access_token: creds.token },
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  /**
   * Resuelve el inbox_id de Chatwoot correspondiente a una instancia de
   * Evolution. La inbox se nombra igual que la instancia (chatwootNameInbox).
   * Cachea el resultado en memoria para no consultar en cada envío.
   */
  private async inboxIdForInstance(
    creds: ChatwootCredentials,
    instanceName: string,
  ): Promise<number | null> {
    if (this.inboxCache.has(instanceName)) {
      return this.inboxCache.get(instanceName) ?? null;
    }
    const acc = encodeURIComponent(creds.accountId);
    const data = await this.apiGet<{
      payload?: Array<{ id?: number; name?: string }>;
    }>(creds, `/api/v1/accounts/${acc}/inboxes`);

    let found: number | null = null;
    for (const ib of data?.payload ?? []) {
      if (ib.name === instanceName && typeof ib.id === 'number') {
        found = ib.id;
        break;
      }
    }
    // Cachear incluso null: si no existe la inbox, no reintentar en cada envío.
    this.inboxCache.set(instanceName, found);
    return found;
  }

  /**
   * Resuelve el id de conversación de Chatwoot para un número, pero SOLO dentro
   * de la inbox del dispositivo (instancia) que hizo el envío. Así no se
   * confunde con conversaciones del mismo número en otras inboxes/dispositivos.
   * Devuelve null si no se puede determinar con certeza (best-effort, no lanza).
   */
  async resolveConversationId(
    numero: string,
    instanceName: string,
  ): Promise<number | null> {
    const creds = await this.getCredentials();
    if (!creds) return null;
    const acc = encodeURIComponent(creds.accountId);

    // Inbox del dispositivo (preferida). Puede ser null si aún no se resuelve.
    const inboxId = await this.inboxIdForInstance(creds, instanceName);

    // 1) Buscar el contacto por número.
    const search = await this.apiGet<{
      payload?: Array<{ id?: number }>;
    }>(
      creds,
      `/api/v1/accounts/${acc}/contacts/search?q=${encodeURIComponent(numero)}`,
    );
    const contactId = search?.payload?.[0]?.id;
    if (!contactId) return null;

    // 2) Conversaciones del contacto.
    const convs = await this.apiGet<{
      payload?: Array<{
        id?: number;
        inbox_id?: number;
        last_activity_at?: number;
      }>;
    }>(creds, `/api/v1/accounts/${acc}/contacts/${contactId}/conversations`);

    const todas = (convs?.payload ?? []).filter(
      (c) => typeof c.id === 'number',
    );
    if (todas.length === 0) return null;

    const masReciente = (
      list: Array<{ id?: number; last_activity_at?: number }>,
    ): number | null => {
      const ordenadas = [...list].sort(
        (a, b) =>
          (b.last_activity_at ?? b.id ?? 0) - (a.last_activity_at ?? a.id ?? 0),
      );
      return ordenadas[0]?.id ?? null;
    };

    // Preferir la conversación en la inbox del dispositivo que envió.
    if (inboxId != null) {
      const enInbox = todas.filter((c) => c.inbox_id === inboxId);
      if (enInbox.length > 0) return masReciente(enInbox);
    }

    // Fallback: el envío pudo salir por otro dispositivo (reintento/re-ruteo),
    // por lo que la conversación puede estar en otra inbox. Asociar la más
    // reciente del contacto es mejor que dejar el registro sin conversación.
    return masReciente(todas);
  }
}
