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

  /** Ajusta el score y pausa el dispositivo si cae bajo el umbral. */
  private async applyReputationDelta(
    record: DeviceReputation,
    delta: number,
  ): Promise<void> {
    const config = await this.configService.get();
    const next = this.clampScore(Number(record.reputationScore) + delta);
    record.reputationScore = next.toFixed(2);
    if (next < Number(config.pauseThreshold)) {
      record.paused = true;
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

  /** Pausa manual: no se le asignan envíos hasta reanudar. */
  async pause(instanceName: string): Promise<void> {
    const record = await this.rateLimit.getOrCreate(instanceName);
    record.paused = true;
    await this.repo.save(record);
  }

  /** Reanuda un dispositivo pausado. */
  async resume(instanceName: string): Promise<void> {
    const record = await this.rateLimit.getOrCreate(instanceName);
    record.paused = false;
    await this.repo.save(record);
  }
}
