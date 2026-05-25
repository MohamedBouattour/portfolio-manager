import { Module } from '@nestjs/common';
import { ScouterController, HealthController } from './controllers/scouter.controller.js';
import { StrategyEvaluatorService } from './services/strategy-evaluator.service.js';
import { ScoutingService } from './services/scouting.service.js';
import { MomentumService } from './services/momentum.service.js';

@Module({
  controllers: [ScouterController, HealthController],
  providers: [StrategyEvaluatorService, ScoutingService, MomentumService],
})
export class AppModule {}
