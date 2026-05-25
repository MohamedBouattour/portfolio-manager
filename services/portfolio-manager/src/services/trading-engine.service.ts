import { Injectable } from '@nestjs/common';
import { ConnectorExchangeService } from './connector-exchange.service.js';
import { ScouterStrategyService } from './scouter-strategy.service.js';
import { Position, InstrumentSpec, BotConfig } from '@portfolio/contracts';
import { getTimeframe } from '@portfolio/contracts/utils';
import { roundQty } from '../utils/math.js';
import { log } from '../utils/logger.js';

@Injectable()
export class TradingEngineService {
  constructor(
    private readonly exchange: ConnectorExchangeService,
    private readonly scouter: ScouterStrategyService
  ) {}

  public async runCycle(): Promise<string> {
    const timestamp = Date.now();
    log.startCapturing();
    log.sep();
    log.info('Starting Trading Engine Execution Cycle...');

    const config: BotConfig = {
      stockSymbols: (process.env.STOCK_SYMBOLS || 'ALL').split(',').map(s => s.trim()),
      interval: getTimeframe(),
      dryRun: process.env.DRY_RUN === 'true',
      balance: parseFloat(process.env.BALANCE || '689'),
      leverage: parseInt(process.env.LEVERAGE || '3', 10),
      feePct: parseFloat(process.env.FEE_PCT || '0.04'),
      profitThresholdPct: parseFloat(process.env.PROFIT_THRESHOLD_PCT || '15'),
      rebuyThresholdPct: parseFloat(process.env.REBUY_THRESHOLD_PCT || '15'),
      reducePct: parseFloat(process.env.REDUCE_PCT || process.env.POSITION_REDUCE_PCT || '15'),
      rebuyQtyPct: parseFloat(process.env.REBUY_QTY_PCT || '15'),
      maxAllocPct: parseFloat(process.env.MAX_ALLOC_PCT || '20'),
      manualMode: process.env.MANUAL_MODE === 'true',
    };

    log.info(`Account Balance: $${config.balance} | Leverage: ${config.leverage}x`);
    log.info(`TP: +${config.profitThresholdPct}% | DCA Rebuy: -${config.rebuyThresholdPct}% (reduce: ${config.reducePct}%)`);

    try {
      let symbolsToProcess = config.stockSymbols;
      if (symbolsToProcess.length === 1 && (symbolsToProcess[0] === 'ALL' || symbolsToProcess[0] === '')) {
        log.info('STOCK_SYMBOLS is set to "ALL" (or empty). Fetching all active stock tokens dynamically...');
        symbolsToProcess = await this.exchange.getActiveStockSymbols();
      }

      const validSymbols = await this.validateSymbols(symbolsToProcess);
      if (validSymbols.length === 0) {
        log.warn('No valid symbols to process. Aborting run.');
        log.saveCapturedLogs(timestamp);
        return 'No valid symbols';
      }

      const openPositions = await this.managePositions(config);
      await this.scoutEntries(validSymbols, openPositions, config);

      log.sep();
      log.ok('Trading Engine execution cycle completed successfully.');
    } catch (err: any) {
      log.error('Cycle crash', err.message);
    }

    log.saveCapturedLogs(timestamp);
    return 'Run completed';
  }

  private async validateSymbols(symbols: string[]): Promise<string[]> {
    const valid: string[] = [];
    for (const sym of symbols) {
      const spec = await this.exchange.getInstrumentSpec(sym);
      if (spec) {
        valid.push(sym);
      }
    }
    log.info(`Validated ${valid.length}/${symbols.length} symbols. Active: ${valid.join(', ')}`);
    return valid;
  }

  private async managePositions(config: BotConfig): Promise<Position[]> {
    log.sep();
    log.info('── POSITION MANAGEMENT ──');

    const positions = await this.exchange.getOpenPositions();
    if (positions.length === 0) {
      log.info('No open positions to manage.');
      return [];
    }

    for (const pos of positions) {
      const pnl = this.calculatePnLPct(pos);
      log.info(
        `[Position] ${pos.symbol} ${pos.side} | Size: ${pos.size} | Entry: ${pos.avgPrice} | Mark: ${pos.markPrice} | PnL: ${pnl.toFixed(2)}%`
      );

      const spec = await this.exchange.getInstrumentSpec(pos.symbol);
      if (!spec) {
        log.warn(`Skipping position management for ${pos.symbol} due to missing spec.`);
        continue;
      }

      if (pnl >= config.profitThresholdPct) {
        if (config.dryRun) {
          log.ok(`[Scout Only] ${pos.symbol}: Take Profit trigger met at PnL: ${pnl.toFixed(2)}%. (No order placed)`);
        } else {
          await this.handleTakeProfit(pos, spec, pnl, config);
        }
      } else if (pnl <= -config.rebuyThresholdPct) {
        if (config.dryRun) {
          log.ok(`[Scout Only] ${pos.symbol}: DCA Rebuy trigger met at PnL: ${pnl.toFixed(2)}%. (No order placed)`);
        } else {
          await this.handleRebuy(pos, spec, pnl, config);
        }
      } else {
        log.info(`${pos.symbol}: no position action needed.`);
      }
    }

    return positions;
  }

  private async scoutEntries(validSymbols: string[], openPositions: Position[], config: BotConfig): Promise<void> {
    log.sep();
    log.info('── ENTRY SIGNAL SCOUTING ──');

    const activeHeldSymbols = new Set(openPositions.map((p) => p.symbol));
    let signalCount = 0;

    for (const symbol of validSymbols) {
      if (activeHeldSymbols.has(symbol)) {
        log.info(`${symbol}: already holding position. Skipping scout.`);
        continue;
      }

      const closes = await this.exchange.getCloses(symbol, config.interval, 200);
      if (closes.length < 2) {
        log.warn(`${symbol}: insufficient candle history (${closes.length} candles).`);
        continue;
      }

      const evalRes = await this.scouter.evaluate(closes, closes.length - 1);
      const shouldEnter = evalRes.strategySignal?.shouldEnter;
      const latestValues = evalRes.strategySignal?.latestValues;

      if (latestValues) {
        log.info(
          `[Scouting] ${symbol} | MACD: ${latestValues.macd.toFixed(4)} | Signal: ${latestValues.signal.toFixed(4)} | Hist: ${latestValues.histogram.toFixed(4)}`
        );
      }

      if (shouldEnter) {
        signalCount++;
        log.ok(`🚀 Strategy triggered entry signal for ${symbol}!`);
        if (config.dryRun) {
          log.info(`[Scout Only] Would open new LONG position for ${symbol} at close price $${closes[closes.length - 1]}.`);
        } else {
          const spec = await this.exchange.getInstrumentSpec(symbol);
          if (spec) {
            const lastClose = closes[closes.length - 1];
            const success = await this.executeNewEntry(symbol, lastClose, spec, config);
            if (success) {
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
          }
        }
      }
    }

    log.info(`Scouting phase complete. Found ${signalCount} signal(s).`);
  }

  private async handleTakeProfit(pos: Position, spec: InstrumentSpec, currentPnL: number, config: BotConfig): Promise<void> {
    if (config.manualMode) {
      log.info(`[Manual Mode] Take Profit trigger met for ${pos.symbol} (PnL: ${currentPnL.toFixed(2)}%). Skipping automatic order execution.`);
      return;
    }
    const rawReduceQty = pos.size * (config.reducePct / 100);
    const qty = roundQty(rawReduceQty, spec);

    if (qty <= 0) {
      log.warn(`${pos.symbol}: reduction qty (${rawReduceQty.toFixed(4)}) is below exchange minimum (${spec.minQty}). Skipping TP.`);
      return;
    }

    const orderSide = pos.side === 'Buy' ? 'Sell' : 'Buy';
    log.info(`Executing take-profit for ${pos.symbol}: reducing size by ${qty} units...`);

    const result = await this.exchange.submitOrder({
      symbol: pos.symbol,
      side: orderSide,
      qty,
      reduceOnly: true,
    });

    if (result) {
      log.ok(`✔ TAKE-PROFIT executed successfully for ${pos.symbol} (PnL: ${currentPnL.toFixed(2)}%)`, result);
    }
  }

  private async handleRebuy(pos: Position, spec: InstrumentSpec, currentPnL: number, config: BotConfig): Promise<void> {
    if (config.manualMode) {
      log.info(`[Manual Mode] DCA Rebuy trigger met for ${pos.symbol} (PnL: ${currentPnL.toFixed(2)}%). Skipping automatic order execution.`);
      return;
    }

    if (pos.lastExecutionPrice && pos.lastExecutionSide === 'Buy') {
      const priceDropThreshold = config.rebuyThresholdPct / pos.leverage;
      const requiredPrice = pos.lastExecutionPrice * (1 - priceDropThreshold / 100);
      if (pos.markPrice > requiredPrice) {
        log.info(
          `[Loop Prevention] ${pos.symbol}: PnL is ${currentPnL.toFixed(2)}% <= -${config.rebuyThresholdPct}%, but current price $${pos.markPrice.toFixed(2)} has not dropped >= ${priceDropThreshold.toFixed(2)}% below last Buy price $${pos.lastExecutionPrice.toFixed(2)}. Skipping DCA Rebuy.`
        );
        return;
      }
    }

    const rawRebuyQty = pos.size * (config.rebuyQtyPct / 100);
    const qty = roundQty(rawRebuyQty, spec);

    if (qty <= 0) {
      log.warn(`${pos.symbol}: DCA rebuy qty (${rawRebuyQty.toFixed(4)}) is below exchange minimum (${spec.minQty}). Skipping Rebuy.`);
      return;
    }

    const marginNeeded = (qty * pos.markPrice) / config.leverage;
    if (marginNeeded > config.balance * 0.95) {
      log.warn(`${pos.symbol}: required margin ($${marginNeeded.toFixed(2)}) exceeds 95% of balance. Skipping Rebuy.`);
      return;
    }

    log.info(`Executing DCA Rebuy for ${pos.symbol}: adding ${qty} units...`);

    const result = await this.exchange.submitOrder({
      symbol: pos.symbol,
      side: pos.side,
      qty,
      reduceOnly: false,
    });

    if (result) {
      log.ok(`✔ DCA REBUY executed successfully for ${pos.symbol} (PnL: ${currentPnL.toFixed(2)}%)`, result);
    }
  }

  private async executeNewEntry(symbol: string, lastPrice: number, spec: InstrumentSpec, config: BotConfig): Promise<boolean> {
    if (config.manualMode) {
      log.info(`[Manual Mode] Entry signal triggered for ${symbol}. Skipping automatic order execution.`);
      return false;
    }
    const targetNotional = config.balance * (config.maxAllocPct / 100) * config.leverage;
    const rawQty = targetNotional / lastPrice;
    const qty = roundQty(rawQty, spec);

    if (qty <= 0) {
      log.warn(`${symbol}: entry qty (${rawQty.toFixed(4)}) is below exchange minimum (${spec.minQty}). Skipping entry.`);
      return false;
    }

    const marginNeeded = (qty * lastPrice) / config.leverage;
    if (marginNeeded > config.balance * 0.95) {
      log.warn(`${symbol}: required margin ($${marginNeeded.toFixed(2)}) exceeds 95% of balance. Skipping entry.`);
      return false;
    }

    log.info(`Setting leverage to ${config.leverage}x for ${symbol}...`);
    const levOk = await this.exchange.setLeverage(symbol, config.leverage);
    if (!levOk) {
      log.error(`Leverage alignment failed for ${symbol}. Order aborted.`);
      return false;
    }

    log.info(`Submitting Buy Market order for ${symbol} with quantity: ${qty}...`);
    const result = await this.exchange.submitOrder({
      symbol,
      side: 'Buy',
      qty,
      reduceOnly: false,
    });

    if (result) {
      log.ok(`✔ NEW LONG position opened for ${symbol}`, result);
      return true;
    }

    return false;
  }

  private calculatePnLPct(pos: Position): number {
    const initialMargin = pos.positionValue / pos.leverage;
    if (initialMargin === 0) return 0;
    return (pos.unrealisedPnl / initialMargin) * 100;
  }
}
