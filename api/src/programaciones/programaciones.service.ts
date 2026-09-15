import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deposito } from './entities/deposito.entity.js';
import { Municipio } from './entities/municipio.entity.js';
import { Programacion } from './entities/programacion.entity.js';

/** URL por defecto del endpoint origen de la programación telefónica. */
const DEFAULT_SOURCE_URL =
  'https://pricecontrolv2.strategee.us/depositos/muestra_telefonica_json';

/** Forma cruda del depósito tal como lo entrega el endpoint externo. */
type RawDeposito = {
  id?: string | number | null;
  IDdeposito?: string | number | null;
  nombre?: string | null;
  telefono?: string | null;
  telefono2?: string | null;
  direccion?: string | null;
};

/** Forma cruda del municipio tal como lo entrega el endpoint externo. */
type RawMunicipio = {
  municipio_id: number;
  municipio: string;
  departamento: string;
  requerido?: number;
  objetivo_triple?: number;
  depositos_devueltos?: number;
  depositos?: RawDeposito[];
};

/** Forma cruda de la respuesta completa del endpoint externo. */
type RawResponse = {
  programacion: {
    id: number;
    fecha_inicio: string;
    fecha_fin: string;
  };
  municipios: RawMunicipio[];
};

/** Resultado de intentar cargar una programación. */
export type CargarResult =
  | { estado: 'creada'; programacion: Programacion }
  | { estado: 'duplicada'; programacion: Programacion };

@Injectable()
export class ProgramacionesService {
  private readonly logger = new Logger(ProgramacionesService.name);

  constructor(
    @InjectRepository(Programacion)
    private readonly programacionRepo: Repository<Programacion>,
    private readonly config: ConfigService,
  ) {}

  private get sourceUrl(): string {
    return this.config.get<string>(
      'PROGRAMACION_SOURCE_URL',
      DEFAULT_SOURCE_URL,
    );
  }

  findAll(): Promise<Programacion[]> {
    return this.programacionRepo.find({
      order: { creadoEn: 'DESC' },
    });
  }

  findOne(id: number): Promise<Programacion | null> {
    return this.programacionRepo.findOne({
      where: { id },
      relations: { municipios: { depositos: true } },
    });
  }

  /**
   * Descarga la programación del endpoint externo y la persiste.
   * Si ya existe una programación con el mismo id, no la vuelve a cargar y
   * devuelve estado 'duplicada'.
   */
  async cargar(): Promise<CargarResult> {
    const data = await this.descargar();

    const existente = await this.programacionRepo.findOne({
      where: { id: data.programacion.id },
    });
    if (existente) {
      this.logger.warn(
        `Programación ${data.programacion.id} ya estaba cargada; se omite.`,
      );
      return { estado: 'duplicada', programacion: existente };
    }

    const programacion = this.mapear(data);
    const guardada = await this.programacionRepo.save(programacion);
    this.logger.log(
      `Programación ${guardada.id} cargada con ${guardada.municipios.length} municipios.`,
    );
    return { estado: 'creada', programacion: guardada };
  }

  /** Llama al endpoint externo y valida la forma básica de la respuesta. */
  private async descargar(): Promise<RawResponse> {
    let res: Response;
    try {
      res = await fetch(this.sourceUrl, {
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      this.logger.error(`No se pudo contactar el endpoint origen: ${err}`);
      throw new ServiceUnavailableException(
        'No se pudo contactar el servicio de programaciones.',
      );
    }

    if (!res.ok) {
      throw new ServiceUnavailableException(
        `El servicio de programaciones respondió con estado ${res.status}.`,
      );
    }

    const data = (await res.json()) as RawResponse;
    if (!data?.programacion?.id || !Array.isArray(data.municipios)) {
      throw new ServiceUnavailableException(
        'La respuesta del servicio de programaciones no tiene el formato esperado.',
      );
    }
    return data;
  }

  /** Convierte la respuesta cruda al árbol de entidades listo para guardar. */
  private mapear(data: RawResponse): Programacion {
    const programacion = new Programacion();
    programacion.id = data.programacion.id;
    programacion.fechaInicio = data.programacion.fecha_inicio;
    programacion.fechaFin = data.programacion.fecha_fin;

    programacion.municipios = data.municipios.map((m) => {
      const municipio = new Municipio();
      municipio.municipioId = m.municipio_id;
      municipio.municipio = m.municipio;
      municipio.departamento = m.departamento;
      municipio.requerido = m.requerido ?? 0;
      municipio.objetivoTriple = m.objetivo_triple ?? 0;
      municipio.depositosDevueltos = m.depositos_devueltos ?? 0;

      municipio.depositos = (m.depositos ?? []).map((d) => {
        const deposito = new Deposito();
        deposito.depositoId = d.id != null ? String(d.id) : '';
        deposito.idDeposito = d.IDdeposito != null ? String(d.IDdeposito) : null;
        deposito.nombre = d.nombre ?? null;
        deposito.telefono = d.telefono ?? null;
        deposito.telefono2 = d.telefono2 ?? null;
        deposito.direccion = d.direccion ?? null;
        return deposito;
      });

      return municipio;
    });

    return programacion;
  }
}
