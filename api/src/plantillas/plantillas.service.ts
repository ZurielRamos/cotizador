import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePlantillaDto } from './dto/create-plantilla.dto.js';
import { RegistrarUsoDto } from './dto/registrar-uso.dto.js';
import { UpdatePlantillaDto } from './dto/update-plantilla.dto.js';
import { Plantilla } from './entities/plantilla.entity.js';

/** Representación de salida: entidad + métricas calculadas. */
export type PlantillaView = Plantilla & {
  tasaEfectividad: number;
  tasaRespuesta: number;
  mensajes: string[];
};

@Injectable()
export class PlantillasService {
  constructor(
    @InjectRepository(Plantilla)
    private readonly plantillaRepository: Repository<Plantilla>,
  ) {}

  /**
   * Añade las métricas calculadas para que se incluyan en la respuesta JSON.
   * Devuelve un objeto plano nuevo: los valores de las tasas provienen de los
   * getters de la entidad (que son de solo lectura, así que no se pueden
   * reasignar sobre la propia instancia).
   */
  private toView(plantilla: Plantilla): PlantillaView {
    return {
      ...plantilla,
      tasaEfectividad: plantilla.tasaEfectividad,
      tasaRespuesta: plantilla.tasaRespuesta,
      mensajes: plantilla.mensajes,
    };
  }

  async create(dto: CreatePlantillaDto): Promise<PlantillaView> {
    const plantilla = this.plantillaRepository.create(dto);
    const guardada = await this.plantillaRepository.save(plantilla);
    return this.toView(guardada);
  }

  async findAll(): Promise<PlantillaView[]> {
    const plantillas = await this.plantillaRepository.find({
      order: { numero: 'ASC' },
    });
    return plantillas.map((p) => this.toView(p));
  }

  async findOne(id: string): Promise<PlantillaView> {
    const plantilla = await this.plantillaRepository.findOne({ where: { id } });
    if (!plantilla) {
      throw new NotFoundException(`Plantilla ${id} no encontrada`);
    }
    return this.toView(plantilla);
  }

  async update(id: string, dto: UpdatePlantillaDto): Promise<PlantillaView> {
    const plantilla = await this.findOne(id);
    Object.assign(plantilla, dto);
    const guardada = await this.plantillaRepository.save(plantilla);
    return this.toView(guardada);
  }

  async remove(id: string): Promise<void> {
    const plantilla = await this.findOne(id);
    await this.plantillaRepository.remove(plantilla);
  }

  /**
   * Registra el resultado de usar la plantilla: incrementa contadores de
   * utilización y efectividad. Lo consumen los bots tras enviar/recibir.
   */
  async registrarUso(id: string, dto: RegistrarUsoDto): Promise<PlantillaView> {
    const plantilla = await this.findOne(id);
    const envios = dto.envios ?? 1;

    plantilla.vecesUsada += envios;
    plantilla.ultimoUsoEn = new Date();

    if (dto.huboRespuesta) {
      plantilla.respuestasRecibidas += 1;
    }
    if (dto.huboCotizacion) {
      plantilla.cotizacionesObtenidas += 1;
      // Una cotización implica que hubo respuesta, aunque el bot no lo marque.
      if (!dto.huboRespuesta) {
        plantilla.respuestasRecibidas += 1;
      }
    }

    const guardada = await this.plantillaRepository.save(plantilla);
    return this.toView(guardada);
  }
}
