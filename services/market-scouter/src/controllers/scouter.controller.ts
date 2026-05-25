import { Controller, Get, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { StrategyEvaluatorService } from '../services/strategy-evaluator.service.js';
import { ScoutingService } from '../services/scouting.service.js';
import { MomentumService } from '../services/momentum.service.js';

@Controller('api')
export class ScouterController {
  constructor(
    private readonly evaluator: StrategyEvaluatorService,
    private readonly scouting: ScoutingService,
    private readonly momentum: MomentumService
  ) {}

  @Post('evaluate')
  async evaluate(
    @Body()
    body: {
      closes: number[];
      index: number;
      position?: any;
      config?: any;
    }
  ) {
    const { closes, index, position, config } = body;
    if (!closes || closes.length === 0) {
      throw new HttpException('Closes array is required', HttpStatus.BAD_REQUEST);
    }
    if (index === undefined || index < 0 || index >= closes.length) {
      throw new HttpException('Invalid index parameter', HttpStatus.BAD_REQUEST);
    }

    try {
      return this.evaluator.evaluate(closes, index, position, config);
    } catch (err: any) {
      throw new HttpException(err.message || 'Evaluation error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('scouting-status')
  async getScoutingStatus() {
    try {
      return await this.scouting.getScoutingStatus();
    } catch (err: any) {
      throw new HttpException(err.message || 'Error getting scouting status', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('momentum')
  async getMomentum() {
    return await this.momentum.getMomentum();
  }
}

@Controller('')
export class HealthController {
  @Get('health')
  getHealth() {
    return { status: 'ok', service: 'market-scouter' };
  }
}
