import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateWarmupConfigDto } from './dto/update-warmup-config.dto.js';
import {
  DEFAULT_TIERS,
  WarmupConfig,
  type WarmupTier,
} from './entities/warmup-config.entity.js';

@Injectable()
export class WarmupConfigService {
  constructor(
    @InjectRepository(WarmupConfig)
    private readonly repo: Repository<WarmupConfig>,
  ) {}

  /** Devuelve la config singleton, creándola con defaults si no existe. */
  async get(): Promise<WarmupConfig> {
    const existing = await this.repo.findOne({
      where: {},
      order: { creadoEn: 'ASC' },
    });
    if (existing) return existing;
    const created = this.repo.create({ tiers: DEFAULT_TIERS });
    return this.repo.save(created);
  }

  async update(dto: UpdateWarmupConfigDto): Promise<WarmupConfig> {
    const config = await this.get();
    if (dto.tiers !== undefined) {
      // Ordenar por minDays asc para que la búsqueda de tier sea determinista.
      config.tiers = [...dto.tiers].sort((a, b) => a.minDays - b.minDays);
    }
    if (dto.timezone !== undefined) config.timezone = dto.timezone;
    if (dto.windowStartHour !== undefined)
      config.windowStartHour = dto.windowStartHour;
    if (dto.windowEndHour !== undefined)
      config.windowEndHour = dto.windowEndHour;
    if (dto.pauseThreshold !== undefined)
      config.pauseThreshold = dto.pauseThreshold.toString();
    if (dto.minReputationMultiplier !== undefined)
      config.minReputationMultiplier = dto.minReputationMultiplier.toString();
    return this.repo.save(config);
  }

  /** Tiers ordenados por minDays ascendente. */
  sortedTiers(config: WarmupConfig): WarmupTier[] {
    return [...config.tiers].sort((a, b) => a.minDays - b.minDays);
  }
}
