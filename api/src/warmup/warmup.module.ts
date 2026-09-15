import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvolutionModule } from '../evolution/evolution.module.js';
import { DeviceReputationService } from './device-reputation.service.js';
import { DeviceReputation } from './entities/device-reputation.entity.js';
import { WarmupConfig } from './entities/warmup-config.entity.js';
import { RateLimitService } from './rate-limit.service.js';
import { WarmupConfigService } from './warmup-config.service.js';
import { WarmupController } from './warmup.controller.js';
import { WebhookController } from './webhook.controller.js';
import { WebhookService } from './webhook.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([WarmupConfig, DeviceReputation]),
    EvolutionModule,
  ],
  controllers: [WarmupController, WebhookController],
  providers: [
    WarmupConfigService,
    RateLimitService,
    DeviceReputationService,
    WebhookService,
  ],
  exports: [WarmupConfigService, RateLimitService, DeviceReputationService],
})
export class WarmupModule {}
