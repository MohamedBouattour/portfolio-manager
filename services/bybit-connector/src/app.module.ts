import { Module } from '@nestjs/common';
import { ConnectorController, HealthController } from './controllers/connector.controller.js';
import { BybitRestService } from './services/bybit-rest.service.js';

@Module({
  controllers: [ConnectorController, HealthController],
  providers: [BybitRestService],
})
export class AppModule {}
