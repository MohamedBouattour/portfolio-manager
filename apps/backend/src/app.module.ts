import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { BybitService } from './bybit.service.js';

@Module({
  controllers: [AppController],
  providers: [BybitService],
})
export class AppModule {}
