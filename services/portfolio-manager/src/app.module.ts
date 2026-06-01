import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PortfolioController, HealthController } from './controllers/portfolio.controller.js';
import { ConnectorExchangeService } from './services/connector-exchange.service.js';
import { ScouterStrategyService } from './services/scouter-strategy.service.js';
import { TradingEngineService } from './services/trading-engine.service.js';
import { CronJobService } from './services/cron-job.service.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [PortfolioController, HealthController],
  providers: [ConnectorExchangeService, ScouterStrategyService, TradingEngineService, CronJobService],
})
export class AppModule {}
