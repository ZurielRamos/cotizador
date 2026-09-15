import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatwootService } from './chatwoot.service.js';
import { ChatwootConfig } from './entities/chatwoot-config.entity.js';
import { EvolutionConfig } from './entities/evolution-config.entity.js';
import { InstanceLock } from './entities/instance-lock.entity.js';
import { EvolutionInstancesService } from './evolution-instances.service.js';
import { EvolutionController } from './evolution.controller.js';
import { EvolutionService } from './evolution.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([EvolutionConfig, InstanceLock, ChatwootConfig]),
  ],
  controllers: [EvolutionController],
  providers: [EvolutionService, EvolutionInstancesService, ChatwootService],
  exports: [EvolutionService, EvolutionInstancesService, ChatwootService],
})
export class EvolutionModule {}
