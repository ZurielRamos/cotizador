import { Module, type OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvolutionModule } from '../evolution/evolution.module.js';
import { Plantilla } from '../plantillas/entities/plantilla.entity.js';
import { Programacion } from '../programaciones/entities/programacion.entity.js';
import { WarmupModule } from '../warmup/warmup.module.js';
import { CampaignRunnerService } from './campaign-runner.service.js';
import { CampaignController } from './campaign.controller.js';
import { CampaignService } from './campaign.service.js';
import { CampaignTarget } from './entities/campaign-target.entity.js';
import { Campaign } from './entities/campaign.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      CampaignTarget,
      Plantilla,
      Programacion,
    ]),
    EvolutionModule,
    WarmupModule,
  ],
  controllers: [CampaignController],
  providers: [CampaignService, CampaignRunnerService],
  exports: [CampaignService],
})
export class CampaniasModule implements OnModuleInit {
  constructor(private readonly runner: CampaignRunnerService) {}

  onModuleInit(): void {
    // Arranca el worker de campañas (intervalo periódico).
    this.runner.registerInterval();
  }
}
