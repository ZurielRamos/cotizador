import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { EvolutionInstancesService } from '../evolution/evolution-instances.service.js';
import { DeviceReputationService } from './device-reputation.service.js';
import { UpdateWarmupConfigDto } from './dto/update-warmup-config.dto.js';
import { RateLimitService, type Availability } from './rate-limit.service.js';
import { WarmupConfigService } from './warmup-config.service.js';

@Controller('warmup')
export class WarmupController {
  constructor(
    private readonly configService: WarmupConfigService,
    private readonly rateLimit: RateLimitService,
    private readonly reputation: DeviceReputationService,
    private readonly instances: EvolutionInstancesService,
  ) {}

  /** Config global de warm-up. */
  @Get('config')
  getConfig() {
    return this.configService.get();
  }

  @Put('config')
  updateConfig(@Body() dto: UpdateWarmupConfigDto) {
    return this.configService.update(dto);
  }

  /**
   * Disponibilidad de todos los dispositivos. Cruza el estado real de conexión
   * (open) de Evolution con la reputación/límites locales. De paso sincroniza
   * firstConnectedAt para instancias que estén conectadas.
   */
  @Get('availability')
  async availabilityAll(): Promise<Availability[]> {
    const list = await this.instances.listInstances();
    const now = new Date();
    const result: Availability[] = [];
    for (const inst of list) {
      const connected = inst.connectionStatus === 'open';
      if (connected) {
        await this.reputation.markConnected(inst.name, now);
      }
      result.push(
        await this.rateLimit.availability(inst.name, connected, now),
      );
    }
    return result;
  }

  /** Disponibilidad de un dispositivo puntual. */
  @Get('availability/:name')
  async availabilityOne(@Param('name') name: string): Promise<Availability> {
    const list = await this.instances.listInstances();
    const inst = list.find((i) => i.name === name);
    const connected = inst?.connectionStatus === 'open';
    if (connected) await this.reputation.markConnected(name);
    return this.rateLimit.availability(name, connected);
  }

  /**
   * Sincroniza (adopta) las instancias existentes en Evolution: crea su
   * registro de reputación, siembra la antigüedad desde el createdAt de
   * Evolution (o desde ahora si está conectada) y registra el webhook para
   * empezar a recibir eventos. Idempotente.
   */
  @Post('sync')
  async sync(): Promise<{
    total: number;
    webhooksRegistrados: number;
    reputacionesSembradas: number;
  }> {
    const list = await this.instances.listInstances();
    const now = new Date();
    let webhooksRegistrados = 0;
    let reputacionesSembradas = 0;

    for (const inst of list) {
      // Antigüedad: preferir createdAt de Evolution; si no, "ahora" solo si
      // está conectada (una instancia nunca conectada no arranca el reloj).
      let fecha: Date | null = null;
      if (inst.createdAt) {
        const d = new Date(inst.createdAt);
        if (!Number.isNaN(d.getTime())) fecha = d;
      }
      if (!fecha && inst.connectionStatus === 'open') fecha = now;

      if (fecha) {
        await this.reputation.seedFirstConnected(inst.name, fecha);
        reputacionesSembradas += 1;
      } else {
        // Al menos crear el registro (sin antigüedad todavía).
        await this.rateLimit.getOrCreate(inst.name);
      }

      const ok = await this.instances.ensureWebhook(inst.name);
      if (ok) webhooksRegistrados += 1;
    }

    return {
      total: list.length,
      webhooksRegistrados,
      reputacionesSembradas,
    };
  }

  /** Pausa manual de un dispositivo. */
  @Post('devices/:name/pause')
  @HttpCode(HttpStatus.NO_CONTENT)
  pause(@Param('name') name: string) {
    return this.reputation.pause(name);
  }

  /** Reanuda un dispositivo pausado. */
  @Post('devices/:name/resume')
  @HttpCode(HttpStatus.NO_CONTENT)
  resume(@Param('name') name: string) {
    return this.reputation.resume(name);
  }
}
