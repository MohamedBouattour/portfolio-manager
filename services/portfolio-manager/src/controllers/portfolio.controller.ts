import { Controller, Get, Post, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ConnectorExchangeService } from '../services/connector-exchange.service.js';
import { TradingEngineService } from '../services/trading-engine.service.js';
import { ExecutionStoreService } from '../services/execution-store.service.js';
import { DatabaseService } from '../services/db.service.js';
import { getLogsDir, getTimeframe, setTimeframe } from '@portfolio/contracts/utils';
import { roundQty, parseNumericEnv } from '../utils/math.js';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api')
export class PortfolioController {
  constructor(
    private readonly exchange: ConnectorExchangeService,
    private readonly tradingEngineService: TradingEngineService,
    private readonly executionStore: ExecutionStoreService,
    private readonly db: DatabaseService
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

      // Get operations summary for enriching positions
      const opsSummary = await this.db.getOperationsSummary();
      const summaryMap = new Map(opsSummary.map(s => [s.symbol, s]));

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
          // Use reliable fallback for loop prevention
          const effectiveLastPrice = lastExecPrice ?? pos.avgPrice;
          if (effectiveLastPrice && lastExecSide === 'Sell') {
            const priceRiseThreshold = profitThresholdPct / pos.leverage;
            const requiredPrice = effectiveLastPrice * (1 + priceRiseThreshold / 100);
            if (pos.markPrice < requiredPrice) {
              action = 'HOLD';
              qty = 0;
              reason = `PnL is +${pnlPct.toFixed(2)}% >= +${profitThresholdPct}%, but price ($${pos.markPrice.toFixed(2)}) has not risen >= ${priceRiseThreshold.toFixed(2)}% above last Sell price ($${effectiveLastPrice.toFixed(2)}). Skipping TP to prevent loop.`;
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
          // Use reliable fallback for loop prevention (KEY FIX)
          const effectiveLastPrice = lastExecPrice ?? pos.avgPrice;
          const effectiveLastSide = lastExecSide ?? 'Buy'; // Assume Buy if position exists
          if (effectiveLastPrice && effectiveLastSide === 'Buy') {
            const priceDropThreshold = rebuyThresholdPct / pos.leverage;
            const requiredPrice = effectiveLastPrice * (1 - priceDropThreshold / 100);
            if (pos.markPrice > requiredPrice) {
              action = 'HOLD';
              qty = 0;
              reason = `PnL is ${pnlPct.toFixed(2)}% <= -${rebuyThresholdPct}%, but price ($${pos.markPrice.toFixed(2)}) has not dropped >= ${priceDropThreshold.toFixed(2)}% below last Buy price ($${effectiveLastPrice.toFixed(2)}). Skipping rebuy to prevent loop.`;
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

        // Enrich with operations data from DB
        const opsData = summaryMap.get(pos.symbol);

        return {
          ...pos,
          lastExecutionPrice: lastExecPrice,
          lastExecutionSide: lastExecSide,
          decision: { action, qty, reason },
          // Operations enrichment
          dcaCount: opsData?.dcaCount ?? 0,
          tpCount: opsData?.tpCount ?? 0,
          totalOps: opsData?.totalOps ?? 0,
          lastActionTime: opsData?.lastActionTime ?? null,
          lastAction: opsData?.lastAction ?? null,
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

      // Fetch open positions to get mark price and calculate average price before/after
      const positions = await this.exchange.getOpenPositions();
      const pos = positions.find(p => p.symbol === symbol);
      let price = pos?.markPrice;

      if (!price) {
        const closes = await this.exchange.getCloses(symbol, '1', 1);
        if (closes && closes.length > 0) {
          price = closes[0];
        }
      }

      if (!price || isNaN(price)) {
        price = 0;
      }

      const orderLeverage = leverage ?? pos?.leverage ?? parseInt(process.env.LEVERAGE || '3', 10);
      
      let action: 'ENTRY' | 'DCA_REBUY' | 'TAKE_PROFIT' | 'CLOSE' | 'MANUAL' = 'MANUAL';
      if (pos) {
        if (reduceOnly) {
          if (rounded >= pos.size - 0.0001) {
            action = 'CLOSE';
          } else {
            action = 'TAKE_PROFIT';
          }
        } else {
          if (pos.side === side) {
            action = 'DCA_REBUY';
          } else {
            action = 'MANUAL';
          }
        }
      } else {
        if (!reduceOnly && (side === 'Buy' || side === 'Sell')) {
          action = 'ENTRY';
        }
      }

      let avgPriceBefore: number | undefined;
      let avgPriceAfter: number | undefined;
      let pnlPctBefore: number | undefined;
      let marginUsed: number | undefined;

      if (pos) {
        avgPriceBefore = pos.avgPrice;
        const initialMargin = pos.positionValue / pos.leverage;
        pnlPctBefore = initialMargin > 0 ? (pos.unrealisedPnl / initialMargin) * 100 : 0;
        marginUsed = (rounded * price) / orderLeverage;

        if (!reduceOnly && pos.side === side) {
          const newSize = pos.size + rounded;
          avgPriceAfter = ((pos.size * pos.avgPrice) + (rounded * price)) / newSize;
        }
      }

      // Record manual orders in execution store and operations DB (updates cache and DB)
      await this.executionStore.recordOperation({
        symbol,
        side,
        action,
        qty: rounded,
        price,
        avgPriceBefore,
        avgPriceAfter,
        pnlPctBefore,
        marginUsed,
        leverage: orderLeverage,
        orderId: result.orderId,
        source: 'manual',
      });

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

  @Post('operations/sync')
  async syncOperations(@Query('symbol') symbol?: string) {
    try {
      const result = await this.executionStore.syncFromBybitExecutions(symbol);
      return { status: 'ok', ...result };
    } catch (err: any) {
      throw new HttpException(err.message || 'Error syncing operations', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ─── Operations History Endpoints ────────────────────────────────

  @Get('operations')
  async getOperations(
    @Query('symbol') symbol?: string,
    @Query('limit') limit?: string
  ) {
    try {
      const limitNum = parseInt(limit || '100', 10);
      if (symbol) {
        return await this.db.getOperationsBySymbol(symbol, limitNum);
      }
      return await this.db.getAllRecentOperations(limitNum);
    } catch (err: any) {
      throw new HttpException(err.message || 'Error fetching operations', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('operations/summary')
  async getOperationsSummary() {
    try {
      return await this.db.getOperationsSummary();
    } catch (err: any) {
      throw new HttpException(err.message || 'Error fetching operations summary', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ─── Logs ────────────────────────────────────────────────────────

  @Get('logs/latest')
  async getLatestLog() {
    try {
      const logsDir = getLogsDir();
      if (!fs.existsSync(logsDir)) {
        return { timestamp: 0, content: 'No logs available. Wait for a bot execution or scout run.' };
      }
      const files = fs.readdirSync(logsDir)
        .filter(f => f.endsWith('.log') && !f.endsWith('-scout.log'))
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
