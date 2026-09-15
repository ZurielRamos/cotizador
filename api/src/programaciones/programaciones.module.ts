import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deposito } from './entities/deposito.entity.js';
import { Municipio } from './entities/municipio.entity.js';
import { Programacion } from './entities/programacion.entity.js';
import { ProgramacionesController } from './programaciones.controller.js';
import { ProgramacionesService } from './programaciones.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Programacion, Municipio, Deposito])],
  controllers: [ProgramacionesController],
  providers: [ProgramacionesService],
})
export class ProgramacionesModule {}
