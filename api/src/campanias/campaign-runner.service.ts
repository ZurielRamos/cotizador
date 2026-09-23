import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ChatwootService } from '../evolution/chatwoot.service.js';
import { EvolutionInstancesService } from '../evolution/evolution-instances.service.js';
import { Plantilla } from '../plantillas/entities/plantilla.entity.js';
import { DeviceReputationService } from '../warmup/device-reputation.service.js';
import { RateLimitService } from '../warmup/rate-limit.service.js';
import { CampaignTarget } from './entities/campaign-target.entity.js';
import { Campaign } from './entities/campaign.entity.js';

/** Espera entre pasos (mensajes) de una misma plantilla, en ms. */
const STEP_DELAY_MS = 4000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Worker que procesa las campañas en curso. En cada tick:
 *  - toma los dispositivos conectados, no bloqueados y con capacidad (Fase 1),
 *  - a cada uno le asigna un target pendiente (balanceo: 1 envío/dispositivo
 *    por tick; el cooldown de warm-up evita ráfagas),
 *  - envía la secuencia de mensajes de la plantilla y actualiza métricas.
 */
@Injectable()
export class CampaignRunnerService {
  private readonly logger = new Logger(CampaignRunnerService.name);
  /** Evita solapamiento si un tick tarda más que el intervalo. */
  private running = false;

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignTarget)
    private readonly targetRepo: Repository<CampaignTarget>,
    @InjectRepository(Plantilla)
    private readonly plantillaRepo: Repository<Plantilla>,
    private readonly instances: EvolutionInstancesService,
    private readonly chatwoot: ChatwootService,
    private readonly rateLimit: RateLimitService,
    private readonly reputation: DeviceReputationService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  /** Registra el intervalo del worker (llamado desde onModuleInit del módulo). */
  registerInterval(ms = 20_000): void {
    if (this.scheduler.doesExist('interval', 'campaign-runner')) return;
    const handle = setInterval(() => {
      void this.tick();
    }, ms);
    this.scheduler.addInterval('campaign-runner', handle);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.processCampaigns();
    } catch (e) {
      this.logger.error(
        `Error en el tick de campañas: ${
          e instanceof Error ? e.message : 'desconocido'
        }`,
      );
    } finally {
      this.running = false;
    }
  }

  private async processCampaigns(): Promise<void> {
    const activas = await this.campaignRepo.find({
      where: { estado: 'running' },
    });
    if (activas.length === 0) return;

    // Dispositivos disponibles ahora mismo (conectados, no bloqueados, con cupo).
    const disponibles = await this.dispositivosDisponibles();
    if (disponibles.length === 0) return;

    // Cache de plantillas para no consultarlas por cada target.
    const plantillaCache = new Map<string, Plantilla>();

    for (const campaign of activas) {
      if (disponibles.length === 0) break;

      // Un target pendiente por cada dispositivo disponible (balanceo simple).
      const pendientes = await this.targetRepo.find({
        where: { campaign: { id: campaign.id }, estado: 'pending' },
        take: disponibles.length,
        order: { creadoEn: 'ASC' },
      });

      if (pendientes.length === 0) {
        await this.maybeComplete(campaign.id);
        continue;
      }

      for (const target of pendientes) {
        // Si el municipio ya cumplió su cuota de cotizaciones, saltar sin gastar
        // un dispositivo ni un envío.
        if (await this.municipioCumplido(campaign.id, target)) {
          target.estado = 'skipped';
          await this.targetRepo.save(target);
          continue;
        }
        const device = disponibles.shift();
        if (!device) break;
        await this.enviarTarget(target, device, plantillaCache);
      }
    }
  }

  /** Nombres de instancias que pueden enviar en este momento. */
  private async dispositivosDisponibles(): Promise<string[]> {
    const list = await this.instances.listInstances();
    const result: string[] = [];
    for (const inst of list) {
      const connected = inst.connectionStatus === 'open';
      if (!connected || inst.blocked) continue;
      const av = await this.rateLimit.availability(inst.name, connected);
      if (av.canSend) result.push(inst.name);
    }
    return result;
  }

  private async getPlantilla(
    id: string,
    cache: Map<string, Plantilla>,
  ): Promise<Plantilla | null> {
    if (cache.has(id)) return cache.get(id) ?? null;
    const p = await this.plantillaRepo.findOne({ where: { id } });
    if (p) cache.set(id, p);
    return p;
  }

  /**
   * ¿El municipio del target ya alcanzó su meta (requerido) de cotizaciones
   * en esta campaña? Si requerido es 0 (sin meta), nunca se considera cumplido.
   */
  private async municipioCumplido(
    campaignId: string,
    target: CampaignTarget,
  ): Promise<boolean> {
    if (!target.municipio || target.requerido <= 0) return false;
    const cotizaciones = await this.targetRepo.count({
      where: {
        campaign: { id: campaignId },
        municipio: target.municipio,
        cotizacion: true,
      },
    });
    return cotizaciones >= target.requerido;
  }

  private async enviarTarget(
    target: CampaignTarget,
    instanceName: string,
    cache: Map<string, Plantilla>,
  ): Promise<void> {
    // Marca "sending" para evitar que otro tick lo tome.
    target.estado = 'sending';
    target.instanceName = instanceName;
    target.intentos += 1;
    await this.targetRepo.save(target);

    const plantilla = await this.getPlantilla(target.plantillaId, cache);
    if (!plantilla) {
      target.estado = 'failed';
      target.ultimoError = 'Plantilla no encontrada';
      await this.targetRepo.save(target);
      return;
    }

    try {
      const mensajes = plantilla.mensajes;
      for (let i = 0; i < mensajes.length; i++) {
        await this.instances.sendText(instanceName, target.numero, mensajes[i]);
        if (i < mensajes.length - 1) await sleep(STEP_DELAY_MS);
      }

      target.estado = 'sent';
      target.enviadoEn = new Date();
      target.ultimoError = null;

      // Asociar la conversación de Chatwoot (best-effort, no bloquea el envío).
      try {
        const convId = await this.chatwoot.resolveConversationId(
          target.numero,
          instanceName,
        );
        if (convId != null) target.chatwootConversationId = convId;
      } catch {
        // Ignorado: la conversación se puede resolver luego.
      }

      await this.targetRepo.save(target);

      // Actualiza warm-up (contadores + cooldown) y métricas de la plantilla.
      await this.reputation.registerSend(instanceName);
      plantilla.vecesUsada += 1;
      plantilla.ultimoUsoEn = new Date();
      await this.plantillaRepo.save(plantilla);
    } catch (e) {
      target.estado = 'failed';
      target.ultimoError =
        e instanceof Error ? e.message : 'Error de envío desconocido';
      await this.targetRepo.save(target);
      await this.reputation.registerFailed(instanceName);
    }
  }

  /**
   * Marca la campaña como completada solo cuando ya no queda nada por procesar:
   * ni targets en curso ('pending'/'sending') ni municipios sin lanzar
   * ('queued'). Si aún hay municipios encolados, la campaña sigue viva a la
   * espera de que se envíen.
   */
  private async maybeComplete(campaignId: string): Promise<void> {
    const restantes = await this.targetRepo.count({
      where: {
        campaign: { id: campaignId },
        estado: In(['queued', 'pending', 'sending']),
      },
    });
    if (restantes === 0) {
      await this.campaignRepo.update(
        { id: campaignId },
        { estado: 'completed' },
      );
    }
  }
}
