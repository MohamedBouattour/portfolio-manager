import { Controller, Get, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ConnectorExchangeService } from '../services/connector-exchange.service.js';
import { TradingEngineService } from '../services/trading-engine.service.js';
import { ExecutionStoreService } from '../services/execution-store.service.js';
import { getLogsDir, getTimeframe, setTimeframe } from '@portfolio/contracts/utils';
import { roundQty, parseNumericEnv } from '../utils/math.js';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api')
export class PortfolioController {
  constructor(
    private readonly exchange: ConnectorExchangeService,
    private readonly tradingEngineService: TradingEngineService,
    private readonly executionStore: ExecutionStoreService
  ) {}

  @Get('config')
  getConfig() {
    const isManual = process.env.MANUAL_MODE?.trim().toLowerCase() === 'true';
    const rebuyQtyPct = parseNumericEnv(process.env.REBUY_QTY_PCT, 15);
    const tf = getTimeframe();
    console.log(`[Portfolio Config] Request received. timeframe: ${tf}, MANUAL_MODE env: '${process.env.MANUAL_MODE}', parsed: ${isManual}, rebuyQtyPct: ${rebuyQtyPct}`);
    return {
      timeframe: tf,
      manualMode: isManual,
      rebuyQtyPct,
      balance: parseNumericEnv(process.env.BALANCE, 689),
      leverage: Math.round(parseNumericEnv(process.env.LEVERAGE, 3)),
      feePct: parseNumericEnv(process.env.FEE_PCT, 0.04),
      profitThresholdPct: parseNumericEnv(process.env.PROFIT_THRESHOLD_PCT, 15),
      rebuyThresholdPct: parseNumericEnv(process.env.REBUY_THRESHOLD_PCT, 15),
      reducePct: parseNumericEnv(process.env.REDUCE_PCT || process.env.POSITION_REDUCE_PCT, 15),
      maxAllocPct: parseNumericEnv(process.env.MAX_ALLOC_PCT, 5),
    };
  }

  @Post('config')
  async updateConfig(@Body() body: { timeframe?: string }) {
    if (body.timeframe) {
      setTimeframe(body.timeframe);
      console.log(`[Portfolio Config] Timeframe updated to: ${body.timeframe}`);
    }
    return this.getConfig();
  }

  @Get('balance')
  async getBalance() {
    try {
      const balance = await this.exchange.getWalletBalance();
      return balance;
    } catch (err: any) {
      throw new HttpException(err.message || 'Error fetching balance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('positions')
  async getPositions() {
    try {
      const positions = await this.exchange.getOpenPositions();
      const profitThresholdPct = parseNumericEnv(process.env.PROFIT_THRESHOLD_PCT, 15);
      const rebuyThresholdPct = parseNumericEnv(process.env.REBUY_THRESHOLD_PCT, 15);
      const reducePct = parseNumericEnv(process.env.REDUCE_PCT || process.env.POSITION_REDUCE_PCT, 15);
      const rebuyQtyPct = parseNumericEnv(process.env.REBUY_QTY_PCT, 15);

      const enriched = positions.map((pos) => {
        const initialMargin = pos.positionValue / pos.leverage;
        const pnlPct = initialMargin > 0 ? (pos.unrealisedPnl / initialMargin) * 100 : 0;

        const storedExec = this.executionStore.get(pos.symbol);
        const lastExecPrice = storedExec?.lastExecutionPrice ?? pos.lastExecutionPrice;
        const lastExecSide = storedExec?.lastExecutionSide ?? pos.lastExecutionSide;

        let action = 'HOLD';
        let qty = 0;
        let reason = `PnL is ${pnlPct.toFixed(2)}% (within [-${rebuyThresholdPct}%, +${profitThresholdPct}%]). Holding position.`;

        if (pnlPct >= profitThresholdPct) {
          let skipped = false;
          if (lastExecPrice && lastExecSide === 'Sell') {
            const priceRiseThreshold = profitThresholdPct / pos.leverage;
            const requiredPrice = lastExecPrice * (1 + priceRiseThreshold / 100);
            if (pos.markPrice < requiredPrice) {
              action = 'HOLD';
              qty = 0;
              reason = `PnL is +${pnlPct.toFixed(2)}% >= +${profitThresholdPct}%, but price ($${pos.markPrice.toFixed(2)}) has not risen >= ${priceRiseThreshold.toFixed(2)}% above last Sell price ($${lastExecPrice.toFixed(2)}). Skipping TP to prevent loop.`;
              skipped = true;
            }
          }
          if (!skipped) {
            const qtyToReduce = pos.size * (reducePct / 100);
            action = 'REDUCE';
            qty = parseFloat(qtyToReduce.toFixed(4));
            reason = `Take Profit triggered. PnL is +${pnlPct.toFixed(2)}% >= +${profitThresholdPct}%. Reducing position size by ${reducePct}%.`;
          }
        } else if (pnlPct <= -rebuyThresholdPct) {
          let skipped = false;
          if (lastExecPrice && lastExecSide === 'Buy') {
            const priceDropThreshold = rebuyThresholdPct / pos.leverage;
            const requiredPrice = lastExecPrice * (1 - priceDropThreshold / 100);
            if (pos.markPrice > requiredPrice) {
              action = 'HOLD';
              qty = 0;
              reason = `PnL is ${pnlPct.toFixed(2)}% <= -${rebuyThresholdPct}%, but price ($${pos.markPrice.toFixed(2)}) has not dropped >= ${priceDropThreshold.toFixed(2)}% below last Buy price ($${lastExecPrice.toFixed(2)}). Skipping rebuy to prevent loop.`;
              skipped = true;
            }
          }

          if (!skipped) {
            const rawRebuyQty = pos.size * (rebuyQtyPct / 100);
            action = 'DCA_REBUY';
            qty = parseFloat(rawRebuyQty.toFixed(4));
            reason = `DCA Rebuy triggered. PnL is ${pnlPct.toFixed(2)}% <= -${rebuyThresholdPct}%. Adding position size by ${rebuyQtyPct}%.`;
          }
        }

        return {
          ...pos,
          lastExecutionPrice: lastExecPrice,
          lastExecutionSide: lastExecSide,
          decision: { action, qty, reason }
        };
      });

      return enriched;
    } catch (err: any) {
      throw new HttpException(err.message || 'Error fetching positions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('execute-order')
  async executeOrder(
    @Body()
    body: {
      symbol: string;
      side: 'Buy' | 'Sell';
      qty: number;
      reduceOnly?: boolean;
      leverage?: number;
    }
  ) {
    const { symbol, side, qty, reduceOnly, leverage } = body;
    if (!symbol || !side || !qty) {
      throw new HttpException('Missing required order parameters', HttpStatus.BAD_REQUEST);
    }
    try {
      if (leverage && !reduceOnly) {
        await this.exchange.setLeverage(symbol, leverage);
      }
      const spec = await this.exchange.getInstrumentSpec(symbol);
      const rounded = spec ? roundQty(qty, spec) : qty;

      if (rounded <= 0) {
        throw new HttpException(`Quantity rounded to 0 based on instrument minQty/qtyStep rules`, HttpStatus.BAD_REQUEST);
      }

      const result = await this.exchange.submitOrder({
        symbol,
        side,
        qty: rounded,
        reduceOnly: !!reduceOnly,
      });

      if (!result) {
        throw new HttpException('Order submission failed on exchange', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return result;
    } catch (err: any) {
      throw new HttpException(err.message || 'Order execution error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('run-cycle')
  async runCycle() {
    try {
      const result = await this.tradingEngineService.runCycle();
      return { status: 'ok', result };
    } catch (err: any) {
      throw new HttpException(err.message || 'Cycle run execution error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('logs/latest')
  async getLatestLog() {
    try {
      const logsDir = getLogsDir();
      if (!fs.existsSync(logsDir)) {
        return { timestamp: 0, content: 'No logs available. Wait for a bot execution or scout run.' };
      }
      const files = fs.readdirSync(logsDir)
        .filter(f => f.endsWith('.log'))
        .map(f => {
          const name = f.replace('.log', '');
          return {
            filename: f,
            timestamp: parseInt(name, 10) || 0
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);

      if (files.length === 0) {
        return { timestamp: 0, content: 'No logs found. Run scouting or execute the bot to generate logs.' };
      }

      const latest = files[0];
      const content = fs.readFileSync(path.join(logsDir, latest.filename), 'utf8');
      return {
        timestamp: latest.timestamp,
        content
      };
    } catch (err: any) {
      throw new HttpException(err.message || 'Failed to read latest log', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

@Controller('')
export class HealthController {
  @Get('health')
  getHealth() {
    return { status: 'ok', service: 'portfolio-manager' };
  }
}
