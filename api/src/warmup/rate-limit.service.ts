import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceReputation } from './entities/device-reputation.entity.js';
import {
  WarmupConfig,
  type WarmupTier,
} from './entities/warmup-config.entity.js';
import { WarmupConfigService } from './warmup-config.service.js';

/** Motivo por el que un dispositivo no puede enviar en este momento. */
export type BlockReason =
  | 'paused'
  | 'not_connected'
  | 'outside_window'
  | 'daily_limit'
  | 'hourly_limit'
  | 'cooldown'
  | null;

/** Snapshot de disponibilidad de un dispositivo para enviar. */
export type Availability = {
  instanceName: string;
  canSend: boolean;
  reason: BlockReason;
  tier: number;
  tierLabel: string;
  ageDays: number | null;
  reputationScore: number;
  dailyLimit: number;
  sentToday: number;
  remainingToday: number;
  hourlyLimit: number;
  sentThisHour: number;
  remainingThisHour: number;
  /** Próximo instante en que termina el cooldown; ISO o null. */
  nextAllowedAt: string | null;
  withinWindow: boolean;
  paused: boolean;
};

@Injectable()
export class RateLimitService {
  constructor(
    @InjectRepository(DeviceReputation)
    private readonly repo: Repository<DeviceReputation>,
    private readonly configService: WarmupConfigService,
  ) {}

  /** Obtiene o crea el registro de reputación de una instancia. */
  async getOrCreate(instanceName: string): Promise<DeviceReputation> {
    let record = await this.repo.findOne({ where: { instanceName } });
    if (!record) {
      record = this.repo.create({ instanceName });
      record = await this.repo.save(record);
    }
    return record;
  }

  /** Antigüedad en días desde firstConnectedAt (null si nunca conectó). */
  private ageDays(record: DeviceReputation, now: Date): number | null {
    if (!record.firstConnectedAt) return null;
    const ms = now.getTime() - record.firstConnectedAt.getTime();
    return Math.max(0, Math.floor(ms / 86_400_000));
  }

  /** Tier correspondiente a una antigüedad dada. */
  private tierForAge(tiers: WarmupTier[], ageDays: number | null): WarmupTier {
    const sorted = [...tiers].sort((a, b) => a.minDays - b.minDays);
    const days = ageDays ?? 0;
    let selected = sorted[0];
    for (const t of sorted) {
      if (days >= t.minDays) selected = t;
    }
    return selected;
  }

  /** Hora local (0-23) según la zona horaria configurada. */
  private localHour(now: Date, timezone: string): number {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      });
      return Number(fmt.format(now));
    } catch {
      return now.getUTCHours();
    }
  }

  /** ¿Estamos dentro de la ventana horaria permitida? */
  private isWithinWindow(config: WarmupConfig, now: Date): boolean {
    const hour = this.localHour(now, config.timezone);
    const { windowStartHour: start, windowEndHour: end } = config;
    // Ventana normal (start < end) o que cruza medianoche (start > end).
    if (start <= end) return hour >= start && hour < end;
    return hour >= start || hour < end;
  }

  /** Resetea contadores si cambió el día/hora (comparación en UTC). */
  private applyWindowResets(record: DeviceReputation, now: Date): void {
    const dayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const hourStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
      ),
    );

    if (
      !record.dayWindowStart ||
      record.dayWindowStart.getTime() !== dayStart.getTime()
    ) {
      record.sentToday = 0;
      record.dayWindowStart = dayStart;
    }
    if (
      !record.hourWindowStart ||
      record.hourWindowStart.getTime() !== hourStart.getTime()
    ) {
      record.sentThisHour = 0;
      record.hourWindowStart = hourStart;
    }
  }

  /**
   * Límite efectivo = límite del tier × multiplicador de reputación,
   * con un piso mínimo definido en la config. Nunca baja de 0.
   */
  private effectiveLimit(
    baseLimit: number,
    reputation: number,
    minMultiplier: number,
  ): number {
    const multiplier = Math.max(minMultiplier, reputation);
    return Math.max(0, Math.floor(baseLimit * multiplier));
  }

  /**
   * Calcula la disponibilidad de un dispositivo. `connected` indica si la
   * instancia está actualmente `open` en Evolution (lo pasa el llamador).
   * Persiste los resets de ventana si corresponde.
   */
  async availability(
    instanceName: string,
    connected: boolean,
    now: Date = new Date(),
  ): Promise<Availability> {
    const config = await this.configService.get();
    const record = await this.getOrCreate(instanceName);
    this.applyWindowResets(record, now);
    await this.repo.save(record);

    const reputation = Number(record.reputationScore);
    const minMultiplier = Number(config.minReputationMultiplier);
    const ageDays = this.ageDays(record, now);
    const tier = this.tierForAge(config.tiers, ageDays);

    const dailyLimit = this.effectiveLimit(
      tier.dailyLimit,
      reputation,
      minMultiplier,
    );
    const hourlyLimit = this.effectiveLimit(
      tier.hourlyLimit,
      reputation,
      minMultiplier,
    );

    const remainingToday = Math.max(0, dailyLimit - record.sentToday);
    const remainingThisHour = Math.max(0, hourlyLimit - record.sentThisHour);
    const withinWindow = this.isWithinWindow(config, now);
    const cooldownActive =
      record.nextAllowedAt !== null && record.nextAllowedAt.getTime() > now.getTime();

    let reason: BlockReason = null;
    if (record.paused) reason = 'paused';
    else if (!connected) reason = 'not_connected';
    else if (!withinWindow) reason = 'outside_window';
    else if (remainingToday <= 0) reason = 'daily_limit';
    else if (remainingThisHour <= 0) reason = 'hourly_limit';
    else if (cooldownActive) reason = 'cooldown';

    return {
      instanceName,
      canSend: reason === null,
      reason,
      tier: tier.tier,
      tierLabel: tier.label,
      ageDays,
      reputationScore: reputation,
      dailyLimit,
      sentToday: record.sentToday,
      remainingToday,
      hourlyLimit,
      sentThisHour: record.sentThisHour,
      remainingThisHour,
      nextAllowedAt: record.nextAllowedAt
        ? record.nextAllowedAt.toISOString()
        : null,
      withinWindow,
      paused: record.paused,
    };
  }

  /** Delay aleatorio (jitter) en ms según el tier del dispositivo, para el próximo envío. */
  async randomDelayMs(
    record: DeviceReputation,
    now: Date = new Date(),
  ): Promise<number> {
    const config = await this.configService.get();
    const ageDays = this.ageDays(record, now);
    const tier = this.tierForAge(config.tiers, ageDays);
    const min = tier.minDelaySeconds;
    const max = Math.max(min, tier.maxDelaySeconds);
    const seconds = min + Math.random() * (max - min);
    return Math.round(seconds * 1000);
  }
}
