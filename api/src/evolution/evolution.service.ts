import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { decrypt, encrypt } from '../common/crypto.util.js';
import { UpdateEvolutionConfigDto } from './dto/update-evolution-config.dto.js';
import { EvolutionConfig } from './entities/evolution-config.entity.js';

/**
 * Vista pública de la configuración: nunca incluye el apiKey en claro.
 */
export type PublicEvolutionConfig = {
  configured: boolean;
  baseUrl: string | null;
  apiKeyMask: string | null;
  actualizadoEn: Date | null;
};

@Injectable()
export class EvolutionService {
  constructor(
    @InjectRepository(EvolutionConfig)
    private readonly repo: Repository<EvolutionConfig>,
    private readonly config: ConfigService,
  ) {}

  private get encryptionSecret(): string {
    return this.config.get<string>('APP_ENCRYPTION_KEY', 'change-me-in-env');
  }

  /** Devuelve el registro singleton, o null si no existe. */
  private async findRecord(): Promise<EvolutionConfig | null> {
    return this.repo.findOne({ where: {}, order: { creadoEn: 'ASC' } });
  }

  /** Configuración pública (sin secreto) para el frontend. */
  async getPublicConfig(): Promise<PublicEvolutionConfig> {
    const record = await this.findRecord();
    if (!record) {
      return {
        configured: false,
        baseUrl: null,
        apiKeyMask: null,
        actualizadoEn: null,
      };
    }
    return {
      configured: true,
      baseUrl: record.baseUrl,
      apiKeyMask: `••••••••${record.apiKeyLast4}`,
      actualizadoEn: record.actualizadoEn,
    };
  }

  /** Crea o actualiza la configuración (singleton), cifrando el apiKey. */
  async upsert(dto: UpdateEvolutionConfigDto): Promise<PublicEvolutionConfig> {
    const apiKeyEncrypted = encrypt(dto.apiKey, this.encryptionSecret);
    const apiKeyLast4 = dto.apiKey.slice(-4);

    let record = await this.findRecord();
    if (record) {
      record.baseUrl = dto.baseUrl;
      record.apiKeyEncrypted = apiKeyEncrypted;
      record.apiKeyLast4 = apiKeyLast4;
    } else {
      record = this.repo.create({
        baseUrl: dto.baseUrl,
        apiKeyEncrypted,
        apiKeyLast4,
      });
    }

    await this.repo.save(record);
    return this.getPublicConfig();
  }

  /**
   * Devuelve las credenciales descifradas para uso interno del backend
   * (por ejemplo, para llamar a Evolution API). NO exponer por HTTP.
   */
  async getCredentials(): Promise<{ baseUrl: string; apiKey: string } | null> {
    const record = await this.findRecord();
    if (!record) return null;
    return {
      baseUrl: record.baseUrl,
      apiKey: decrypt(record.apiKeyEncrypted, this.encryptionSecret),
    };
  }
}
