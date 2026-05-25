import { Module } from '@nestjs/common';
import { PortfolioController, HealthController } from './controllers/portfolio.controller.js';
import { ConnectorExchangeService } from './services/connector-exchange.service.js';
import { ScouterStrategyService } from './services/scouter-strategy.service.js';
import { TradingEngineService } from './services/trading-engine.service.js';

@Module({
  controllers: [PortfolioController, HealthController],
  providers: [ConnectorExchangeService, ScouterStrategyService, TradingEngineService],
})
export class AppModule {}
