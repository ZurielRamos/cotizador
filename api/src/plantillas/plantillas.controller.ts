import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreatePlantillaDto } from './dto/create-plantilla.dto.js';
import { RegistrarUsoDto } from './dto/registrar-uso.dto.js';
import { UpdatePlantillaDto } from './dto/update-plantilla.dto.js';
import { PlantillasService } from './plantillas.service.js';

@Controller('plantillas')
export class PlantillasController {
  constructor(private readonly plantillasService: PlantillasService) {}

  @Post()
  create(@Body() dto: CreatePlantillaDto) {
    return this.plantillasService.create(dto);
  }

  @Get()
  findAll() {
    return this.plantillasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.plantillasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlantillaDto,
  ) {
    return this.plantillasService.update(id, dto);
  }

  /** Los bots llaman aquí para registrar envíos, respuestas y cotizaciones. */
  @Post(':id/uso')
  registrarUso(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarUsoDto,
  ) {
    return this.plantillasService.registrarUso(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.plantillasService.remove(id);
  }
}
