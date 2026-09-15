import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plantilla } from './entities/plantilla.entity.js';
import { PlantillasController } from './plantillas.controller.js';
import { PlantillasService } from './plantillas.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Plantilla])],
  controllers: [PlantillasController],
  providers: [PlantillasService],
})
export class PlantillasModule {}
