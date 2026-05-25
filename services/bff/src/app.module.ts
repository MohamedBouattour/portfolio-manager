import { Module } from '@nestjs/common';
import { BffController, HealthController } from './controllers/bff.controller.js';

@Module({
  controllers: [BffController, HealthController],
})
export class AppModule {}
