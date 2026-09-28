import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceReputation } from './entities/device-reputation.entity.js';
import { RateLimitService } from './rate-limit.service.js';
import { WarmupConfigService } from './warmup-config.service.js';

/** Ajustes de reputación por evento (delta sobre el score 0..1). */
const REPUTATION_DELTAS = {
  delivered: +0.01,
  reply: +0.03,
  failed: -0.05,
  unexpectedDisconnect: -0.15,
} as const;

@Injectable()
export class DeviceReputationService {
  constructor(
    @InjectRepository(DeviceReputation)
    private readonly repo: Repository<DeviceReputation>,
    private readonly rateLimit: RateLimitService,
    private readonly configService: WarmupConfigService,
  ) {}

  private clampScore(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  /**
   * Ajusta el score y gestiona la pausa AUTOMÁTICA por reputación:
   *  - si cae bajo el umbral → pausa automática.
   *  - si se recupera por encima del umbral (+ histéresis) → se levanta la
   *    pausa automática.
   * Nunca toca una pausa manual (record.manualPause): esa solo se levanta con
   * resume() explícito.
   */
  private async applyReputationDelta(
    record: DeviceReputation,
    delta: number,
  ): Promise<void> {
    const config = await this.configService.get();
    const threshold = Number(config.pauseThreshold);
    const next = this.clampScore(Number(record.reputationScore) + delta);
    record.reputationScore = next.toFixed(2);

    if (record.manualPause) return; // La pausa manual manda; no la tocamos.

    if (next < threshold) {
      record.paused = true;
    } else if (record.paused && next >= threshold + 0.05) {
      // Histéresis: exige recuperar un pequeño margen antes de reactivar,
      // para no oscilar pausa/activo en el borde del umbral.
      record.paused = false;
    }
  }

  /**
   * Marca que una instancia está conectada (open). Fija firstConnectedAt la
   * primera vez para arrancar el conteo de antigüedad.
   */
  async markConnected(
    instanceName: string,
    now: Date = new Date(),
  ): Promise<void> {
    const record = await this.rateLimit.getOrCreate(instanceName);
    if (!record.firstConnectedAt) {
      record.firstConnectedAt = now;
      await this.repo.save(record);
    }
  }

  /**
   * Siembra firstConnectedAt para instancias adoptadas (preexistentes en
   * Evolution). Solo lo fija si aún no tiene valor, para no reescribir la
   * antigüedad ya registrada. Devuelve el registro (creándolo si no existe).
   */
  async seedFirstConnected(
    instanceName: string,
    fecha: Date,
  ): Promise<DeviceReputation> {
    const record = await this.rateLimit.getOrCreate(instanceName);
    if (!record.firstConnectedAt) {
      record.firstConnectedAt = fecha;
      await this.repo.save(record);
    }
    return record;
  }

  /**
   * Registra un envío exitoso: incrementa contadores de ventana y totales,
   * y programa el próximo envío permitido (cooldown/jitter según el tier).
   */
  async registerSend(
    instanceName: string,
    now: Date = new Date(),
  ): Promise<void> {
    const record = await this.rateLimit.getOrCreate(instanceName);
    // Asegura que las ventanas estén frescas antes de incrementar.
    await this.rateLimit.availability(instanceName, true, now);
    const fresh = await this.rateLimit.getOrCreate(instanceName);

    fresh.sentToday += 1;
    fresh.sentThisHour += 1;
    fresh.totalSent += 1;
    fresh.lastSentAt = now;
    const delayMs = await this.rateLimit.randomDelayMs(fresh, now);
    fresh.nextAllowedAt = new Date(now.getTime() + delayMs);
    await this.repo.save(fresh);
    void record;
  }

  /** Evento: mensaje entregado. */
  async registerDelivered(instanceName: string): Promise<void> {
    const record = await this.rateLimit.getOrCreate(instanceName);
    record.totalDelivered += 1;
    await this.applyReputationDelta(record, REPUTATION_DELTAS.delivered);
    await this.repo.save(record);
  }

  /** Evento: respuesta recibida del negocio. */
  async registerReply(instanceName: string): Promise<void> {
    const record = await this.rateLimit.getOrCreate(instanceName);
    record.totalReplies += 1;
    await this.applyReputationDelta(record, REPUTATION_DELTAS.reply);
    await this.repo.save(record);
  }

  /** Evento: fallo de envío. */
  async registerFailed(instanceName: string): Promise<void> {
    const record = await this.rateLimit.getOrCreate(instanceName);
    record.totalFailed += 1;
    await this.applyReputationDelta(record, REPUTATION_DELTAS.failed);
    await this.repo.save(record);
  }

  /** Evento: desconexión inesperada (posible señal de bloqueo). */
  async registerUnexpectedDisconnect(instanceName: string): Promise<void> {
    const record = await this.rateLimit.getOrCreate(instanceName);
    await this.applyReputationDelta(
      record,
      REPUTATION_DELTAS.unexpectedDisconnect,
    );
    await this.repo.save(record);
  }

  /** Pausa manual: no se le asignan envíos hasta reanudar explícitamente. */
  async pause(instanceName: string): Promise<void> {
    const record = await this.rateLimit.getOrCreate(instanceName);
    record.paused = true;
    record.manualPause = true;
    await this.repo.save(record);
  }

  /**
   * Reanuda un dispositivo pausado (manual o automático). Limpia la marca de
   * pausa manual. Si la reputación sigue bajo el umbral, un fallo posterior lo
   * podría volver a auto-pausar; por eso, al reanudar manualmente se le da un
   * piso de reputación para que pueda operar.
   */
  async resume(instanceName: string): Promise<void> {
    const record = await this.rateLimit.getOrCreate(instanceName);
    const config = await this.configService.get();
    const threshold = Number(config.pauseThreshold);
    record.paused = false;
    record.manualPause = false;
    // Si está por debajo del umbral, subir al umbral + margen para que no se
    // vuelva a pausar de inmediato al primer evento negativo.
    if (Number(record.reputationScore) < threshold) {
      record.reputationScore = this.clampScore(threshold + 0.1).toFixed(2);
    }
    await this.repo.save(record);
  }
}
