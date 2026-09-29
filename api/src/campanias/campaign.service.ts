import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Plantilla } from '../plantillas/entities/plantilla.entity.js';
import { Deposito } from '../programaciones/entities/deposito.entity.js';
import { Municipio } from '../programaciones/entities/municipio.entity.js';
import { Programacion } from '../programaciones/entities/programacion.entity.js';
import { OnEvent } from '@nestjs/event-emitter';
import { RateLimitService } from '../warmup/rate-limit.service.js';
import {
  INBOUND_REPLY_EVENT,
  type InboundReplyEvent,
} from '../warmup/webhook.service.js';
import { EvolutionInstancesService } from '../evolution/evolution-instances.service.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { CampaignTarget } from './entities/campaign-target.entity.js';
import { Campaign, type CampaignStatus } from './entities/campaign.entity.js';

export type CampaignProgress = {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  sending: number;
  /** Cuántos destinatarios respondieron. */
  respondidas: number;
};

export type CampaignView = {
  id: string;
  nombre: string;
  estado: CampaignStatus;
  plantillaIds: string[];
  creadoEn: Date;
  actualizadoEn: Date;
  progreso: CampaignProgress;
};

/** Código de país de Colombia. */
const CO_COUNTRY_CODE = '57';

/**
 * Normaliza un teléfono al formato internacional que espera Evolution
 * (solo dígitos, con código de país, sin '+').
 *
 * Los depósitos vienen con números locales de Colombia:
 *  - Celulares: 10 dígitos que empiezan por 3 (ej. 3186424139).
 *  - Fijos con indicativo: 10 dígitos que empiezan por 60 (ej. 6041234567).
 * Evolution los rechaza (Bad Request) si les falta el código de país 57.
 *
 * Reglas aplicadas:
 *  - Se quitan todos los no-dígitos.
 *  - Prefijo de marcación internacional '00' → se elimina.
 *  - Un '0' inicial de troncal → se elimina.
 *  - Si ya trae el código país 57 (12 dígitos), se deja igual.
 *  - Si son 10 dígitos locales, se antepone 57.
 */
function normalizeNumero(raw: string): string {
  let n = raw.replace(/\D/g, '');
  if (!n) return '';

  // Prefijo de salida internacional: 00 + país (ej. 0057...).
  if (n.startsWith('00')) n = n.slice(2);

  // Ya viene con código de país de Colombia (57 + 10 dígitos locales).
  if (n.startsWith(CO_COUNTRY_CODE) && n.length === 12) return n;

  // '0' inicial de troncal nacional (ej. 03186424139).
  if (n.length === 11 && n.startsWith('0')) n = n.slice(1);

  // Número local de 10 dígitos (celular 3xx o fijo 60x): anteponer país.
  if (n.length === 10) return CO_COUNTRY_CODE + n;

  // Cualquier otro caso: devolver los dígitos tal cual (se filtra por longitud
  // aguas arriba). Evita romper números ya en formato internacional distinto.
  return n;
}

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(CampaignTarget)
    private readonly targetRepo: Repository<CampaignTarget>,
    @InjectRepository(Plantilla)
    private readonly plantillaRepo: Repository<Plantilla>,
    @InjectRepository(Programacion)
    private readonly programacionRepo: Repository<Programacion>,
    @InjectRepository(Municipio)
    private readonly municipioRepo: Repository<Municipio>,
    @InjectRepository(Deposito)
    private readonly depositoRepo: Repository<Deposito>,
    private readonly rateLimit: RateLimitService,
    private readonly instances: EvolutionInstancesService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateCampaignDto): Promise<CampaignView> {
    // Validar plantillas existentes.
    const plantillas = await this.plantillaRepo.find({
      where: { id: In(dto.plantillaIds) },
    });
    if (plantillas.length !== dto.plantillaIds.length) {
      throw new BadRequestException(
        'Una o más plantillas no existen.',
      );
    }

    // Normalizar y deduplicar números.
    const numeros = [
      ...new Set(dto.numeros.map(normalizeNumero).filter((n) => n.length >= 8)),
    ];
    if (numeros.length === 0) {
      throw new BadRequestException('No hay números válidos en la lista.');
    }

    const campaign = this.campaignRepo.create({
      nombre: dto.nombre,
      estado: 'draft',
      plantillaIds: dto.plantillaIds,
    });
    const saved = await this.campaignRepo.save(campaign);

    // Repartir plantillas round-robin entre los targets.
    const targets = numeros.map((numero, i) =>
      this.targetRepo.create({
        campaign: saved,
        numero,
        plantillaId: dto.plantillaIds[i % dto.plantillaIds.length],
        estado: 'pending',
      }),
    );
    await this.targetRepo.save(targets);

    return this.toView(saved);
  }

  async findAll(): Promise<CampaignView[]> {
    const campaigns = await this.campaignRepo.find({
      order: { creadoEn: 'DESC' },
    });
    return Promise.all(campaigns.map((c) => this.toView(c)));
  }

  async findOne(id: string): Promise<CampaignView> {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaña ${id} no encontrada`);
    return this.toView(campaign);
  }

  private async progress(campaignId: string): Promise<CampaignProgress> {
    const rows = await this.targetRepo
      .createQueryBuilder('t')
      .select('t.estado', 'estado')
      .addSelect('COUNT(*)', 'count')
      .where('t.campaign_id = :id', { id: campaignId })
      .groupBy('t.estado')
      .getRawMany<{ estado: string; count: string }>();

    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.estado] = Number(r.count);

    const pending = counts.pending ?? 0;
    const sending = counts.sending ?? 0;
    const sent = counts.sent ?? 0;
    const failed = counts.failed ?? 0;

    const respondidas = await this.targetRepo.count({
      where: { campaign: { id: campaignId }, respondido: true },
    });

    return {
      total: pending + sending + sent + failed,
      pending,
      sending,
      sent,
      failed,
      respondidas,
    };
  }

  private async toView(campaign: Campaign): Promise<CampaignView> {
    return {
      id: campaign.id,
      nombre: campaign.nombre,
      estado: campaign.estado,
      plantillaIds: campaign.plantillaIds,
      creadoEn: campaign.creadoEn,
      actualizadoEn: campaign.actualizadoEn,
      progreso: await this.progress(campaign.id),
    };
  }

  private async setStatus(
    id: string,
    estado: CampaignStatus,
    from: CampaignStatus[],
  ): Promise<CampaignView> {
    const campaign = await this.campaignRepo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException(`Campaña ${id} no encontrada`);
    if (!from.includes(campaign.estado)) {
      throw new BadRequestException(
        `No se puede cambiar de "${campaign.estado}" a "${estado}".`,
      );
    }
    campaign.estado = estado;
    await this.campaignRepo.save(campaign);
    return this.toView(campaign);
  }

  /** Inicia o reanuda la campaña (pasa a running). */
  start(id: string): Promise<CampaignView> {
    return this.setStatus(id, 'running', ['draft', 'paused']);
  }

  pause(id: string): Promise<CampaignView> {
    return this.setStatus(id, 'paused', ['running']);
  }

  cancel(id: string): Promise<CampaignView> {
    return this.setStatus(id, 'cancelled', [
      'draft',
      'running',
      'paused',
    ]);
  }

  // ---- Integración con Programaciones ----

  /**
   * Destinatarios de una programación: teléfono 1 (normalizado, dedup) con su
   * municipio y la meta (requerido) de ese municipio. El primer depósito con
   * un número dado gana (dedup por número global).
   */
  private async destinatariosDeProgramacion(
    programacionId: number,
  ): Promise<
    Array<{
      numero: string;
      municipio: string;
      departamento: string;
      nombreDeposito: string | null;
      requerido: number;
    }>
  > {
    const prog = await this.programacionRepo.findOne({
      where: { id: programacionId },
      relations: { municipios: { depositos: true } },
    });
    if (!prog) {
      throw new NotFoundException(
        `Programación ${programacionId} no encontrada`,
      );
    }
    const vistos = new Set<string>();
    const result: Array<{
      numero: string;
      municipio: string;
      departamento: string;
      nombreDeposito: string | null;
      requerido: number;
    }> = [];
    for (const m of prog.municipios) {
      for (const d of m.depositos) {
        if (!d.telefono) continue;
        const numero = normalizeNumero(d.telefono);
        if (numero.length < 8 || vistos.has(numero)) continue;
        vistos.add(numero);
        result.push({
          numero,
          municipio: m.municipio,
          departamento: m.departamento,
          nombreDeposito: d.nombre,
          requerido: m.requerido,
        });
      }
    }
    return result;
  }

  /** Solo los números (para conteos/estimaciones). */
  private async numerosDeProgramacion(
    programacionId: number,
  ): Promise<string[]> {
    const dest = await this.destinatariosDeProgramacion(programacionId);
    return dest.map((d) => d.numero);
  }

  /**
   * Resumen ligero de la campaña (más reciente) de cada programación que
   * tenga una. Devuelto como mapa { [programacionId]: {...} } para que el
   * listado de programaciones lo consuma sin acoplar módulos.
   */
  async resumenPorProgramaciones(): Promise<
    Record<
      number,
      {
        estado: CampaignStatus;
        progreso: CampaignProgress;
      }
    >
  > {
    const campaigns = await this.campaignRepo.find({
      where: { programacionId: Not(IsNull()) },
      order: { creadoEn: 'DESC' },
    });

    const result: Record<
      number,
      { estado: CampaignStatus; progreso: CampaignProgress }
    > = {};
    // Como vienen ordenadas desc, la primera por programación es la más reciente.
    for (const c of campaigns) {
      if (c.programacionId == null) continue;
      if (result[c.programacionId]) continue;
      result[c.programacionId] = {
        estado: c.estado,
        progreso: await this.progress(c.id),
      };
    }
    return result;
  }

  /**
   * Estado por número de la campaña más reciente de una programación, para
   * casar con los depósitos en la UI del detalle. Incluye el resultado del
   * envío (estado), el motivo del fallo (ultimoError), intentos y la fecha de
   * envío, además del id de conversación de Chatwoot.
   */
  async targetsPorProgramacion(programacionId: number): Promise<
    Record<
      string,
      {
        estado: string;
        chatwootConversationId: number | null;
        respondido: boolean;
        cotizacion: boolean;
        ultimoError: string | null;
        intentos: number;
        enviadoEn: Date | null;
      }
    >
  > {
    const campaign = await this.campaignVigenteDeProgramacion(programacionId);
    if (!campaign) return {};
    const targets = await this.targetRepo.find({
      where: { campaign: { id: campaign.id } },
    });
    const map: Record<
      string,
      {
        estado: string;
        chatwootConversationId: number | null;
        respondido: boolean;
        cotizacion: boolean;
        ultimoError: string | null;
        intentos: number;
        enviadoEn: Date | null;
      }
    > = {};
    for (const t of targets) {
      map[t.numero] = {
        estado: t.estado,
        chatwootConversationId: t.chatwootConversationId,
        respondido: t.respondido,
        cotizacion: t.cotizacion,
        ultimoError: t.ultimoError,
        intentos: t.intentos,
        enviadoEn: t.enviadoEn,
      };
    }
    return map;
  }

  /**
   * Resumen por municipio de la campaña de una programación:
   * { [municipio]: { requerido, cotizaciones, metaCumplida } }.
   */
  async municipiosResumen(
    programacionId: number,
  ): Promise<
    Record<
      string,
      { requerido: number; cotizaciones: number; metaCumplida: boolean }
    >
  > {
    const campaign = await this.campaignVigenteDeProgramacion(programacionId);
    if (!campaign) return {};
    const targets = await this.targetRepo.find({
      where: { campaign: { id: campaign.id } },
    });
    const map: Record<
      string,
      { requerido: number; cotizaciones: number; metaCumplida: boolean }
    > = {};
    for (const t of targets) {
      const key = t.municipio ?? '—';
      if (!map[key]) {
        map[key] = { requerido: t.requerido, cotizaciones: 0, metaCumplida: false };
      }
      if (t.cotizacion) map[key].cotizaciones += 1;
    }
    for (const k of Object.keys(map)) {
      const e = map[k];
      e.metaCumplida = e.requerido > 0 && e.cotizaciones >= e.requerido;
    }
    return map;
  }

  /**
   * Marca/desmarca manualmente la cotización de un destinatario (por número)
   * en la campaña de una programación. Devuelve el nuevo estado del target.
   */
  async marcarCotizacion(
    programacionId: number,
    numero: string,
    cotizacion: boolean,
  ): Promise<{ numero: string; cotizacion: boolean }> {
    const campaign = await this.campaignOfProgramacion(programacionId);
    if (!campaign) {
      throw new NotFoundException(
        `La programación ${programacionId} no tiene campaña.`,
      );
    }
    // Normaliza igual que al crear los targets (con código país) para casar.
    const numeroNorm = normalizeNumero(numero);
    const target = await this.targetRepo.findOne({
      where: { campaign: { id: campaign.id }, numero: numeroNorm },
    });
    if (!target) {
      throw new NotFoundException(
        `No hay destinatario con número ${numeroNorm} en la campaña.`,
      );
    }
    target.cotizacion = cotizacion;
    await this.targetRepo.save(target);
    return { numero: numeroNorm, cotizacion };
  }

  /** Campaña activa/última de una programación (la más reciente). */
  private campaignOfProgramacion(
    programacionId: number,
  ): Promise<Campaign | null> {
    return this.campaignRepo.findOne({
      where: { programacionId },
      order: { creadoEn: 'DESC' },
    });
  }

  /**
   * Campaña VIGENTE (accionable) de una programación: la más reciente que NO
   * esté cancelada ni completada. Las vistas de estado por municipio deben
   * usar esta, no la última a secas: una campaña cancelada dejaría targets en
   * 'pending'/'queued' que la UI mostraría erróneamente como "en curso" y
   * bloquearía el reenvío.
   */
  private campaignVigenteDeProgramacion(
    programacionId: number,
  ): Promise<Campaign | null> {
    return this.campaignRepo.findOne({
      where: {
        programacionId,
        estado: Not(In(['cancelled', 'completed'])),
      },
      order: { creadoEn: 'DESC' },
    });
  }

  /**
   * Resumen para el detalle de la programación: números disponibles,
   * plantillas activas, dispositivos disponibles, capacidad diaria combinada
   * y estimación de días. Incluye la campaña existente si la hay.
   */
  async programacionSummary(programacionId: number): Promise<{
    numerosDisponibles: number;
    plantillasActivas: number;
    dispositivosConectados: number;
    dispositivosDisponibles: number;
    capacidadDiaria: number;
    diasEstimados: number | null;
    campaign: CampaignView | null;
  }> {
    const numeros = await this.numerosDeProgramacion(programacionId);
    const plantillasActivas = await this.plantillaRepo.count({
      where: { activa: true },
    });

    // Dispositivos: conectados, no bloqueados; capacidad = suma de límites diarios.
    const instancias = await this.instances.listInstances();
    let dispositivosConectados = 0;
    let dispositivosDisponibles = 0;
    let capacidadDiaria = 0;
    for (const inst of instancias) {
      const connected = inst.connectionStatus === 'open';
      if (!connected || inst.blocked) continue;
      dispositivosConectados += 1;
      const av = await this.rateLimit.availability(inst.name, connected);
      capacidadDiaria += av.dailyLimit;
      if (av.canSend) dispositivosDisponibles += 1;
    }

    const diasEstimados =
      capacidadDiaria > 0 ? Math.ceil(numeros.length / capacidadDiaria) : null;

    const existing = await this.campaignOfProgramacion(programacionId);
    return {
      numerosDisponibles: numeros.length,
      plantillasActivas,
      dispositivosConectados,
      dispositivosDisponibles,
      capacidadDiaria,
      diasEstimados,
      campaign: existing ? await this.toView(existing) : null,
    };
  }

  /**
   * Crea la campaña de una programación usando el teléfono 1 de sus depósitos
   * y todas las plantillas activas, y la deja lista (draft) o iniciada.
   * Solo una campaña "viva" por programación: si ya hay una draft/running/
   * paused, se rechaza.
   *
   * @param municipios Nombres de municipios cuyos targets quedan listos para
   *   enviar (estado 'pending'). Si es null, se activan TODOS los municipios
   *   (comportamiento del botón global "Iniciar campaña"). Los municipios no
   *   incluidos quedan en 'queued' (creados pero no lanzados).
   */
  async createFromProgramacion(
    programacionId: number,
    iniciar = false,
    municipios: string[] | null = null,
  ): Promise<CampaignView> {
    const viva = await this.campaignRepo.findOne({
      where: {
        programacionId,
        estado: Not(In(['completed', 'cancelled'])),
      },
    });
    if (viva) {
      throw new BadRequestException(
        'Esta programación ya tiene una campaña en curso. Cancélala o espera a que termine.',
      );
    }

    const destinatarios = await this.destinatariosDeProgramacion(
      programacionId,
    );
    if (destinatarios.length === 0) {
      throw new BadRequestException(
        'La programación no tiene teléfonos válidos.',
      );
    }

    const plantillas = await this.plantillaRepo.find({
      where: { activa: true },
    });
    if (plantillas.length === 0) {
      throw new BadRequestException('No hay plantillas activas.');
    }
    const plantillaIds = plantillas.map((p) => p.id);

    // Debe haber al menos un dispositivo conectado y no bloqueado para poder
    // ejecutar la campaña; si no, no tiene sentido iniciarla.
    const instancias = await this.instances.listInstances();
    const hayDispositivos = instancias.some(
      (i) => i.connectionStatus === 'open' && !i.blocked,
    );
    if (!hayDispositivos) {
      throw new BadRequestException(
        'No hay dispositivos conectados disponibles para ejecutar la campaña.',
      );
    }

    const campaign = this.campaignRepo.create({
      nombre: `Programación #${programacionId}`,
      programacionId,
      estado: iniciar ? 'running' : 'draft',
      plantillaIds,
    });
    const saved = await this.campaignRepo.save(campaign);

    // Los municipios activados quedan listos para enviar ('pending'); el resto
    // se crean 'queued' (encolados pero sin lanzar) para poder enviarlos luego
    // municipio por municipio.
    const activados = municipios === null ? null : new Set(municipios);
    const targets = destinatarios.map((d, i) =>
      this.targetRepo.create({
        campaign: saved,
        numero: d.numero,
        municipio: d.municipio,
        departamento: d.departamento,
        nombreDeposito: d.nombreDeposito,
        requerido: d.requerido,
        plantillaId: plantillaIds[i % plantillaIds.length],
        estado:
          activados === null || activados.has(d.municipio)
            ? 'pending'
            : 'queued',
      }),
    );
    await this.targetRepo.save(targets);

    return this.toView(saved);
  }

  /**
   * Envía (encola) la campaña de un municipio concreto de una programación.
   * - Si la programación no tiene campaña viva, la crea con TODOS los
   *   municipios en 'queued' y activa solo el municipio pedido.
   * - Si ya existe, activa (pasa a 'pending') los targets 'queued' de ese
   *   municipio y REINTENTA los que quedaron 'failed', y reanuda la campaña.
   *
   * No reenvía los que ya se enviaron con éxito ('sent') ni los omitidos por
   * cuota cumplida ('skipped'): solo los pendientes de lanzar y los fallidos.
   * Devuelve la vista de la campaña.
   */
  async enviarMunicipio(
    programacionId: number,
    municipio: string,
  ): Promise<CampaignView> {
    let campaign = await this.campaignRepo.findOne({
      where: {
        programacionId,
        estado: Not(In(['completed', 'cancelled'])),
      },
    });

    // Sin campaña viva: crearla con este municipio activado y el resto en cola.
    if (!campaign) {
      const view = await this.createFromProgramacion(programacionId, true, [
        municipio,
      ]);
      return view;
    }

    // Activar (pasar a 'pending') los targets del municipio que aún no se han
    // lanzado ('queued') o que fallaron ('failed', para reintentarlos). Los
    // fallidos reinician intentos/error para un reintento limpio. Los ya
    // enviados ('sent') y omitidos ('skipped') NO se tocan.
    const result = await this.targetRepo
      .createQueryBuilder()
      .update(CampaignTarget)
      .set({ estado: 'pending', intentos: 0, ultimoError: null })
      .where('campaign_id = :cid', { cid: campaign.id })
      .andWhere('municipio = :mun', { mun: municipio })
      .andWhere('estado IN (:...estados)', { estados: ['queued', 'failed'] })
      .execute();

    if ((result.affected ?? 0) === 0) {
      throw new BadRequestException(
        `El municipio "${municipio}" no tiene envíos pendientes ni fallidos por reintentar.`,
      );
    }

    // Asegurar que la campaña esté corriendo para que el runner la procese.
    if (campaign.estado !== 'running') {
      campaign.estado = 'running';
      campaign = await this.campaignRepo.save(campaign);
    }

    return this.toView(campaign);
  }

  /**
   * Obtiene (o crea) la campaña viva de una programación. Si no existe, la
   * crea con TODOS los municipios en cola ('queued') sin activar ninguno, para
   * poder activar luego envíos individuales (depósito a depósito).
   */
  private async campaignVivaOCrear(programacionId: number): Promise<Campaign> {
    const viva = await this.campaignRepo.findOne({
      where: {
        programacionId,
        estado: Not(In(['completed', 'cancelled'])),
      },
    });
    if (viva) return viva;
    // municipios = [] → ninguno activado; todos los targets quedan 'queued'.
    await this.createFromProgramacion(programacionId, true, []);
    const creada = await this.campaignRepo.findOne({
      where: {
        programacionId,
        estado: Not(In(['completed', 'cancelled'])),
      },
    });
    if (!creada) {
      throw new BadRequestException('No se pudo crear la campaña.');
    }
    return creada;
  }

  /**
   * Envía (encola) un depósito individual por su teléfono. Crea la campaña si
   * no existe. Activa ese target ('queued'/'failed' → 'pending') sin tocar el
   * resto. Idempotente: si ya está enviado o en curso, no hace nada nuevo.
   */
  async enviarDeposito(
    programacionId: number,
    telefono: string,
  ): Promise<CampaignView> {
    const numero = normalizeNumero(telefono);
    if (numero.length < 8) {
      throw new BadRequestException('Teléfono inválido.');
    }
    let campaign = await this.campaignVivaOCrear(programacionId);

    const result = await this.targetRepo
      .createQueryBuilder()
      .update(CampaignTarget)
      .set({ estado: 'pending', intentos: 0, ultimoError: null })
      .where('campaign_id = :cid', { cid: campaign.id })
      .andWhere('numero = :num', { num: numero })
      .andWhere('estado IN (:...estados)', { estados: ['queued', 'failed'] })
      .execute();

    if ((result.affected ?? 0) === 0) {
      throw new BadRequestException(
        'El depósito no tiene envíos pendientes ni fallidos por reintentar (ya fue enviado o no pertenece a la campaña).',
      );
    }

    if (campaign.estado !== 'running') {
      campaign.estado = 'running';
      campaign = await this.campaignRepo.save(campaign);
    }
    return this.toView(campaign);
  }

  /**
   * Recarga un depósito con otro aleatorio del mismo municipio: consulta la API
   * de PriceControl (random_json) excluyendo los depósitos ya presentes del
   * municipio, y REEMPLAZA el depósito original (datos + su target) por el
   * nuevo, dejándolo listo para enviar ('pending'). Devuelve el nuevo depósito.
   */
  async recargarDeposito(
    programacionId: number,
    depositoId: string,
  ): Promise<{
    depositoId: string;
    idDeposito: string | null;
    nombre: string | null;
    telefono: string | null;
    municipio: string;
  }> {
    // Depósito original + su municipio dentro de esta programación.
    const deposito = await this.depositoRepo.findOne({
      where: {
        depositoId,
        municipio: { programacion: { id: programacionId } },
      },
      relations: { municipio: { programacion: true } },
    });
    if (!deposito) {
      throw new NotFoundException(
        `Depósito ${depositoId} no encontrado en la programación ${programacionId}.`,
      );
    }
    const municipio = deposito.municipio;

    // Excluir todos los depósitos ya presentes del municipio (evitar repetir).
    const delMunicipio = await this.depositoRepo.find({
      where: { municipio: { id: municipio.id } },
    });
    const excludeIds = delMunicipio
      .map((d) => d.depositoId)
      .filter((v): v is string => Boolean(v));

    // Consultar PriceControl un depósito aleatorio del municipio.
    const nuevo = await this.fetchDepositoAleatorio(
      municipio.municipioId,
      excludeIds,
    );
    if (!nuevo) {
      throw new BadRequestException(
        `No hay más depósitos disponibles en ${municipio.municipio} para recargar.`,
      );
    }

    const numeroViejo = deposito.telefono
      ? normalizeNumero(deposito.telefono)
      : null;

    // Reemplazar los datos del depósito por los del nuevo.
    deposito.depositoId = String(nuevo.id);
    deposito.idDeposito = nuevo.IDdeposito ?? null;
    deposito.nombre = nuevo.nombre ?? null;
    deposito.telefono = nuevo.telefono1 ?? null;
    deposito.telefono2 = nuevo.telefono2 ?? null;
    deposito.direccion = nuevo.direccion ?? null;
    await this.depositoRepo.save(deposito);

    // Reemplazar el target correspondiente (si hay campaña viva) por el nuevo
    // número, dejándolo listo para enviar.
    const campaign = await this.campaignRepo.findOne({
      where: {
        programacionId,
        estado: Not(In(['completed', 'cancelled'])),
      },
    });
    const numeroNuevo = nuevo.telefono1
      ? normalizeNumero(nuevo.telefono1)
      : null;
    if (campaign && numeroNuevo && numeroNuevo.length >= 8) {
      let target = numeroViejo
        ? await this.targetRepo.findOne({
            where: { campaign: { id: campaign.id }, numero: numeroViejo },
          })
        : null;
      if (target) {
        target.numero = numeroNuevo;
        target.nombreDeposito = nuevo.nombre ?? null;
        target.estado = 'pending';
        target.intentos = 0;
        target.ultimoError = null;
        target.instanceName = null;
        target.chatwootConversationId = null;
        target.respondido = false;
        target.cotizacion = false;
        target.enviadoEn = null;
      } else {
        // No había target para el viejo: crear uno nuevo para el reemplazo.
        target = this.targetRepo.create({
          campaign,
          numero: numeroNuevo,
          municipio: municipio.municipio,
          departamento: municipio.departamento,
          nombreDeposito: nuevo.nombre ?? null,
          requerido: municipio.requerido,
          plantillaId: campaign.plantillaIds[0],
          estado: 'pending',
        });
      }
      await this.targetRepo.save(target);

      if (campaign.estado !== 'running') {
        campaign.estado = 'running';
        await this.campaignRepo.save(campaign);
      }
    }

    return {
      depositoId: deposito.depositoId,
      idDeposito: deposito.idDeposito,
      nombre: deposito.nombre,
      telefono: deposito.telefono,
      municipio: municipio.municipio,
    };
  }

  /**
   * Consulta la API de PriceControl un depósito aleatorio de un municipio
   * (ciudad_id), excluyendo los ids indicados. Devuelve null si no hay o falla.
   */
  private async fetchDepositoAleatorio(
    municipioId: number,
    excludeIds: string[],
  ): Promise<{
    id: number;
    IDdeposito?: string;
    nombre?: string;
    direccion?: string;
    telefono1?: string;
    telefono2?: string;
  } | null> {
    const base = this.config
      .get<string>('PRICECONTROL_URL', 'https://pricecontrolv2.strategee.us')
      .replace(/\/+$/, '');
    const params = new URLSearchParams({ municipio_id: String(municipioId) });
    if (excludeIds.length > 0) params.set('exclude_ids', excludeIds.join(','));
    const url = `${base}/depositos/random_json?${params.toString()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        success?: boolean;
        deposito?: {
          id: number;
          IDdeposito?: string;
          nombre?: string;
          direccion?: string;
          telefono1?: string;
          telefono2?: string;
        } | null;
      };
      if (!data?.success || !data.deposito) return null;
      return data.deposito;
    } catch {
      return null;
    }
  }

  /**
   * Estado de ejecución por municipio de la campaña de una programación.
   * Para cada municipio: métricas y un estado agregado:
   *  - 'pendiente': ningún target lanzado todavía (todos 'queued').
   *  - 'en_curso': hay targets 'pending'/'sending' en proceso.
   *  - 'con_fallos': ya no hay nada en proceso, no hubo ningún envío exitoso
   *     y hay al menos un fallido → se puede reintentar.
   *  - 'ejecutado': ya no hay nada en proceso y hubo al menos un envío exitoso
   *     (aunque también existan fallidos, que se pueden reintentar aparte).
   * Devuelto como mapa { [municipio]: {...} }.
   */
  async municipiosEstado(programacionId: number): Promise<
    Record<
      string,
      {
        estado: 'pendiente' | 'en_curso' | 'con_fallos' | 'ejecutado';
        total: number;
        enviados: number;
        pendientes: number;
        fallidos: number;
        requerido: number;
        cotizaciones: number;
        metaCumplida: boolean;
      }
    >
  > {
    const campaign = await this.campaignVigenteDeProgramacion(programacionId);
    if (!campaign) return {};
    const targets = await this.targetRepo.find({
      where: { campaign: { id: campaign.id } },
    });

    type Acc = {
      total: number;
      queued: number;
      pending: number;
      sending: number;
      sent: number;
      failed: number;
      skipped: number;
      requerido: number;
      cotizaciones: number;
    };
    const acc = new Map<string, Acc>();
    for (const t of targets) {
      const key = t.municipio ?? '—';
      let e = acc.get(key);
      if (!e) {
        e = {
          total: 0,
          queued: 0,
          pending: 0,
          sending: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
          requerido: t.requerido,
          cotizaciones: 0,
        };
        acc.set(key, e);
      }
      e.total += 1;
      e[t.estado] += 1;
      if (t.cotizacion) e.cotizaciones += 1;
    }

    const map: Record<
      string,
      {
        estado: 'pendiente' | 'en_curso' | 'con_fallos' | 'ejecutado';
        total: number;
        enviados: number;
        pendientes: number;
        fallidos: number;
        requerido: number;
        cotizaciones: number;
        metaCumplida: boolean;
      }
    > = {};
    for (const [k, e] of acc) {
      const enProceso = e.pending + e.sending > 0;
      const sinLanzar = e.queued === e.total;
      let estado: 'pendiente' | 'en_curso' | 'con_fallos' | 'ejecutado';
      if (enProceso) {
        estado = 'en_curso';
      } else if (sinLanzar) {
        estado = 'pendiente';
      } else if (e.sent === 0 && e.failed > 0) {
        // No se envió nada con éxito y hubo fallos: reintentar.
        estado = 'con_fallos';
      } else {
        estado = 'ejecutado';
      }
      map[k] = {
        estado,
        total: e.total,
        enviados: e.sent,
        pendientes: e.queued + e.pending + e.sending,
        fallidos: e.failed,
        requerido: e.requerido,
        cotizaciones: e.cotizaciones,
        metaCumplida: e.requerido > 0 && e.cotizaciones >= e.requerido,
      };
    }
    return map;
  }

  /**
   * Marca como respondido el target de un número cuando llega una respuesta
   * entrante (evento del webhook de Evolution). Toma el target enviado más
   * reciente de ese número en campañas activas.
   */
  @OnEvent(INBOUND_REPLY_EVENT)
  async onInboundReply(payload: InboundReplyEvent): Promise<void> {
    const target = await this.targetRepo
      .createQueryBuilder('t')
      .innerJoin('t.campaign', 'c')
      .where('t.numero = :numero', { numero: payload.numero })
      .andWhere('t.respondido = false')
      .andWhere('c.estado IN (:...estados)', {
        estados: ['running', 'paused', 'completed'],
      })
      .orderBy('t.enviado_en', 'DESC', 'NULLS LAST')
      .getOne();

    if (!target) return;
    target.respondido = true;
    target.respondidoEn = new Date();
    await this.targetRepo.save(target);
  }
}
