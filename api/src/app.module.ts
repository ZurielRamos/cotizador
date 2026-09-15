import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CampaniasModule } from './campanias/campanias.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EvolutionModule } from './evolution/evolution.module.js';
import { PlantillasModule } from './plantillas/plantillas.module.js';
import { ProductosModule } from './productos/productos.module.js';
import { WarmupModule } from './warmup/warmup.module.js';
import { ProgramacionesModule } from './programaciones/programaciones.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    ProductosModule,
    PlantillasModule,
    ProgramacionesModule,
    EvolutionModule,
    WarmupModule,
    CampaniasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
