import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeviceReputationService } from './device-reputation.service.js';

/** Evento emitido cuando llega una respuesta entrante de un negocio. */
export const INBOUND_REPLY_EVENT = 'whatsapp.inbound_reply';

export type InboundReplyEvent = {
  instanceName: string;
  /** Número del remitente en formato solo dígitos. */
  numero: string;
};

/** Payload genérico de un webhook de Evolution. */
export type EvolutionWebhookPayload = {
  event?: string;
  instance?: string;
  data?: unknown;
};

/**
 * Interpreta los webhooks de Evolution y los traduce a eventos de reputación.
 * Eventos relevantes:
 *  - connection.update: state open/close -> conectado / desconexión inesperada
 *  - messages.update: status del mensaje -> entregado / fallido
 *  - messages.upsert: mensaje entrante (fromMe=false) -> respuesta del negocio
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly reputation: DeviceReputationService,
    private readonly events: EventEmitter2,
  ) {}

  /** Extrae el número (solo dígitos) de un JID tipo 5215512345678@s.whatsapp.net. */
  private numeroFromJid(jid: unknown): string | null {
    if (typeof jid !== 'string' || !jid.includes('@')) return null;
    const num = jid.split('@')[0].replace(/\D/g, '');
    return num.length >= 8 ? num : null;
  }

  /** Normaliza el nombre del evento a minúsculas con puntos. */
  private normalizeEvent(event: string | undefined): string {
    return (event ?? '').toLowerCase().replace(/_/g, '.');
  }

  async handle(payload: EvolutionWebhookPayload): Promise<void> {
    const instance = payload.instance;
    if (!instance) return;

    const event = this.normalizeEvent(payload.event);
    const data = (payload.data ?? {}) as Record<string, unknown>;

    try {
      switch (event) {
        case 'connection.update':
          await this.onConnectionUpdate(instance, data);
          break;
        case 'messages.update':
          await this.onMessageUpdate(instance, data);
          break;
        case 'messages.upsert':
          await this.onMessageUpsert(instance, data);
          break;
        default:
          // Otros eventos no afectan la reputación.
          break;
      }
    } catch (e) {
      // Nunca dejar que un webhook tumbe el proceso; solo lo registramos.
      this.logger.warn(
        `Error procesando webhook ${event} de ${instance}: ${
          e instanceof Error ? e.message : 'desconocido'
        }`,
      );
    }
  }

  private async onConnectionUpdate(
    instance: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const state = (data.state ?? data.status) as string | undefined;
    if (state === 'open') {
      await this.reputation.markConnected(instance);
    } else if (state === 'close') {
      // Desconexión: posible señal de bloqueo / expulsión.
      await this.reputation.registerUnexpectedDisconnect(instance);
    }
  }

  private async onMessageUpdate(
    instance: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    // El status puede venir plano o anidado en update.
    const update = (data.update ?? {}) as Record<string, unknown>;
    const raw = (data.status ?? update.status) as unknown;
    const status = typeof raw === 'string' ? raw.toUpperCase() : '';

    // Estados de entrega de WhatsApp: DELIVERY_ACK / READ = entregado.
    if (status === 'DELIVERY_ACK' || status === 'READ' || status === 'PLAYED') {
      await this.reputation.registerDelivered(instance);
    } else if (status === 'ERROR' || status === 'FAILED') {
      await this.reputation.registerFailed(instance);
    }
  }

  private async onMessageUpsert(
    instance: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    // Solo cuentan como "respuesta" los mensajes entrantes (no los propios).
    const key = (data.key ?? {}) as Record<string, unknown>;
    const fromMe = Boolean(key.fromMe);
    if (fromMe) return;

    await this.reputation.registerReply(instance);

    // Notifica a quien corresponda (p. ej. campañas) que hubo respuesta.
    const numero = this.numeroFromJid(key.remoteJid);
    if (numero) {
      const payload: InboundReplyEvent = { instanceName: instance, numero };
      this.events.emit(INBOUND_REPLY_EVENT, payload);
    }
  }
}
