import { Injectable, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TradingEngineService } from './trading-engine.service.js';
import { log } from '../utils/logger.js';

@Injectable()
export class CronJobService {
  private isRunning = false;

  constructor(
    @Inject(TradingEngineService)
    private readonly tradingEngine: TradingEngineService
  ) {}

  @Cron('0 * * * *')
  async handleCron() {
    log.info('[Scheduler] Hourly trading cycle cron triggered.');

    if (this.isRunning) {
      log.warn('[Scheduler] Cycle execution skipped because the previous cycle is still running.');
      return;
    }

    this.isRunning = true;
    try {
      const result = await this.tradingEngine.runCycle();
      log.ok(`[Scheduler] Hourly trading cycle completed. Result: ${result}`);
    } catch (err: any) {
      log.error('[Scheduler] Hourly trading cycle execution error:', err.message || err);
    } finally {
      this.isRunning = false;
    }
  }
}
