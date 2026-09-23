import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CampaignService } from './campaign.service.js';
import { EnviarMunicipioDto } from './dto/enviar-municipio.dto.js';
import { MarcarCotizacionDto } from './dto/marcar-cotizacion.dto.js';

@Controller('campanias')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  /** Resumen (estado + progreso) de la campaña de cada programación. */
  @Get('programaciones/resumen')
  resumenPorProgramaciones() {
    return this.campaignService.resumenPorProgramaciones();
  }

  /** Estado por número (para casar con los depósitos en el detalle). */
  @Get('programacion/:progId/targets')
  targetsByProgramacion(@Param('progId', ParseIntPipe) progId: number) {
    return this.campaignService.targetsPorProgramacion(progId);
  }

  /** Resumen por municipio (cotizaciones/requerido, meta cumplida). */
  @Get('programacion/:progId/municipios')
  municipiosByProgramacion(@Param('progId', ParseIntPipe) progId: number) {
    return this.campaignService.municipiosResumen(progId);
  }

  /** Estado de ejecución por municipio (pendiente/en_curso/ejecutado). */
  @Get('programacion/:progId/municipios/estado')
  municipiosEstado(@Param('progId', ParseIntPipe) progId: number) {
    return this.campaignService.municipiosEstado(progId);
  }

  /** Envía (encola) la campaña de un municipio concreto de la programación. */
  @Post('programacion/:progId/municipio')
  enviarMunicipio(
    @Param('progId', ParseIntPipe) progId: number,
    @Body() dto: EnviarMunicipioDto,
  ) {
    return this.campaignService.enviarMunicipio(progId, dto.municipio);
  }

  /** Marca/desmarca la cotización de un destinatario (por número). */
  @Post('programacion/:progId/cotizacion')
  marcarCotizacion(
    @Param('progId', ParseIntPipe) progId: number,
    @Body() dto: MarcarCotizacionDto,
  ) {
    return this.campaignService.marcarCotizacion(
      progId,
      dto.numero,
      dto.cotizacion,
    );
  }

  /** Resumen de la campaña de una programación (cálculos + campaña si existe). */
  @Get('programacion/:progId')
  summaryByProgramacion(@Param('progId', ParseIntPipe) progId: number) {
    return this.campaignService.programacionSummary(progId);
  }

  /** Crea e inicia la campaña de una programación. */
  @Post('programacion/:progId')
  createFromProgramacion(@Param('progId', ParseIntPipe) progId: number) {
    return this.campaignService.createFromProgramacion(progId, true);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignService.findOne(id);
  }

  /** Inicia o reanuda la campaña. */
  @Post(':id/start')
  start(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignService.start(id);
  }

  @Post(':id/pause')
  pause(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignService.pause(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.campaignService.cancel(id);
  }
}
