import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ProgramacionesService } from './programaciones.service.js';

@Controller('programaciones')
export class ProgramacionesController {
  constructor(private readonly programacionesService: ProgramacionesService) {}

  /**
   * Botón "Cargar programación": descarga la programación del endpoint externo
   * y la guarda. Si ya existía (mismo id) NO la vuelve a cargar y responde con
   * `yaCargada: true` para que el frontend muestre una alerta.
   */
  @Post('cargar')
  @HttpCode(HttpStatus.OK)
  async cargar() {
    const result = await this.programacionesService.cargar();
    const { programacion, estado } = result;
    return {
      yaCargada: estado === 'duplicada',
      mensaje:
        estado === 'duplicada'
          ? `La programación ${programacion.id} ya estaba cargada.`
          : `Programación ${programacion.id} cargada correctamente.`,
      programacion: {
        id: programacion.id,
        fechaInicio: programacion.fechaInicio,
        fechaFin: programacion.fechaFin,
      },
    };
  }

  @Get()
  findAll() {
    return this.programacionesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.programacionesService.findOne(Number(id));
  }
}
