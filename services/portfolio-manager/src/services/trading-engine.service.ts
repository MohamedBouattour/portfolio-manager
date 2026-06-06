import { Injectable } from '@nestjs/common';
import { ConnectorExchangeService } from './connector-exchange.service.js';
import { ScouterStrategyService } from './scouter-strategy.service.js';
import { ExecutionStoreService } from './execution-store.service.js';
import { Position, InstrumentSpec, BotConfig } from '@portfolio/contracts';
import { getTimeframe } from '@portfolio/contracts/utils';
import { roundQty, parseNumericEnv } from '../utils/math.js';
import { log } from '../utils/logger.js';

@Injectable()
export class TradingEngineService {
  constructor(
    private readonly exchange: ConnectorExchangeService,
    private readonly scouter: ScouterStrategyService,
    private readonly executionStore: ExecutionStoreService
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
      balance: parseNumericEnv(process.env.BALANCE, 689),
      leverage: Math.round(parseNumericEnv(process.env.LEVERAGE, 3)),
      feePct: parseNumericEnv(process.env.FEE_PCT, 0.04),
      profitThresholdPct: parseNumericEnv(process.env.PROFIT_THRESHOLD_PCT, 15),
      rebuyThresholdPct: parseNumericEnv(process.env.REBUY_THRESHOLD_PCT, 15),
      reducePct: parseNumericEnv(process.env.REDUCE_PCT || process.env.POSITION_REDUCE_PCT, 15),
      rebuyQtyPct: parseNumericEnv(process.env.REBUY_QTY_PCT, 15),
      maxAllocPct: parseNumericEnv(process.env.MAX_ALLOC_PCT, 5),
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
      await this.scoutEntries(openPositions, config);

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

  private async scoutEntries(openPositions: Position[], config: BotConfig): Promise<void> {
    log.sep();
    log.info('── ENTRY SIGNAL SCOUTING (1D) ──');

    const maxPositions = parseInt(process.env.MAX_POSITIONS || '5', 10);
    const activeHeldSymbols = new Set(openPositions.map((p) => p.symbol));

    const currentCount = openPositions.length;
    if (currentCount >= maxPositions) {
      log.info(`Positions limit reached (${currentCount}/${maxPositions} open). Skipping new entries.`);
      return;
    }

    const availableSlots = maxPositions - currentCount;

    // Fetch scouting results (runs all 3 strategies on 1D timeframe)
    const scoutingResults = await this.scouter.getScoutingStatus();
    let candidates = scoutingResults.filter(
      (r) => !activeHeldSymbols.has(r.symbol) && r.shouldEnter
    );

    log.info(`Found ${candidates.length} entry candidate(s) with 2+ indicator confirmation on 1D timeframe. Available slots: ${availableSlots}/${maxPositions}.`);

    if (candidates.length > availableSlots) {
      log.info(`More candidates than available slots. Sorting by confidence score descending to prioritize the best setups...`);
      candidates.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
      candidates = candidates.slice(0, availableSlots);
      log.info(`Prioritized candidate(s) to enter: ${candidates.map(c => c.symbol).join(', ')}`);
    }

    let enteredCount = 0;
    for (const sr of candidates) {
      const triggered = sr.triggeredStrategies.join(', ');
      log.ok(`🚀 Multi-indicator entry signal for ${sr.symbol} via [${triggered}] (Price: $${sr.price.toFixed(2)}, Confidence: ${sr.confidence}%)`);

      if (config.dryRun) {
        log.info(`[Scout Only] Would open new LONG position for ${sr.symbol} at $${sr.price.toFixed(2)}.`);
        enteredCount++;
      } else {
        const spec = await this.exchange.getInstrumentSpec(sr.symbol);
        if (spec) {
          const success = await this.executeNewEntry(sr.symbol, sr.price, spec, config);
          if (success) {
            enteredCount++;
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
      }
    }

    log.info(`Scouting phase complete. Opened ${enteredCount} new position(s).`);
  }

  // ─── Loop Prevention Checks ────────────────────────────────────────

  /**
   * Determines whether a Take Profit should be skipped to prevent
   * repeated sell orders at the same price level.
   */
  private shouldSkipTakeProfit(
    pos: Position,
    config: BotConfig,
    currentPnL: number
  ): { skip: boolean; reason: string } {
    const lastSellPrice =
      this.executionStore.get(pos.symbol)?.lastExecutionPrice
      ?? pos.lastExecutionPrice
      ?? pos.avgPrice; // Fallback: use avg entry price

    const lastSellSide =
      this.executionStore.get(pos.symbol)?.lastExecutionSide
      ?? pos.lastExecutionSide;

    if (lastSellPrice && lastSellSide === 'Sell') {
      const priceRiseThreshold = config.profitThresholdPct / pos.leverage;
      const requiredPrice = lastSellPrice * (1 + priceRiseThreshold / 100);
      if (pos.markPrice < requiredPrice) {
        const reason = `[Loop Prevention] ${pos.symbol}: PnL is ${currentPnL.toFixed(2)}% >= +${config.profitThresholdPct}%, but current price $${pos.markPrice.toFixed(2)} has not risen >= ${priceRiseThreshold.toFixed(2)}% above last Sell price $${lastSellPrice.toFixed(2)}. Skipping Take Profit.`;
        return { skip: true, reason };
      }
    }

    return { skip: false, reason: '' };
  }

  /**
   * Determines whether a DCA Rebuy should be skipped to prevent
   * repeated buy orders at the same price level.
   *
   * KEY FIX: Falls back to pos.avgPrice and assumes 'Buy' side when
   * no execution history exists — prevents the buy loop bug where
   * missing data bypassed all loop prevention.
   */
  private shouldSkipRebuy(
    pos: Position,
    config: BotConfig,
    currentPnL: number
  ): { skip: boolean; reason: string } {
    const lastBuyPrice =
      this.executionStore.get(pos.symbol)?.lastExecutionPrice
      ?? pos.lastExecutionPrice
      ?? pos.avgPrice; // FIX: reliable fallback to avg entry price

    const lastBuySide =
      this.executionStore.get(pos.symbol)?.lastExecutionSide
      ?? pos.lastExecutionSide
      ?? 'Buy'; // FIX: assume Buy if position exists but no execution history

    if (lastBuyPrice && lastBuySide === 'Buy') {
      const priceDropThreshold = config.rebuyThresholdPct / pos.leverage;
      const requiredPrice = lastBuyPrice * (1 - priceDropThreshold / 100);
      if (pos.markPrice > requiredPrice) {
        const reason = `[Loop Prevention] ${pos.symbol}: PnL is ${currentPnL.toFixed(2)}% <= -${config.rebuyThresholdPct}%, but current price $${pos.markPrice.toFixed(2)} has not dropped >= ${priceDropThreshold.toFixed(2)}% below last Buy price $${lastBuyPrice.toFixed(2)}. Skipping DCA Rebuy.`;
        return { skip: true, reason };
      }
    }

    return { skip: false, reason: '' };
  }

  // ─── Position Management Handlers ──────────────────────────────────

  private async handleTakeProfit(pos: Position, spec: InstrumentSpec, currentPnL: number, config: BotConfig): Promise<void> {
    if (config.manualMode) {
      log.info(`[Manual Mode] Take Profit trigger met for ${pos.symbol} (PnL: ${currentPnL.toFixed(2)}%). Skipping automatic order execution.`);
      return;
    }

    const { skip, reason } = this.shouldSkipTakeProfit(pos, config, currentPnL);
    if (skip) {
      log.info(reason);
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
      this.executionStore.set(pos.symbol, pos.markPrice, orderSide);
      await this.executionStore.recordOperation({
        symbol: pos.symbol,
        side: orderSide,
        action: 'TAKE_PROFIT',
        qty,
        price: pos.markPrice,
        avgPriceBefore: pos.avgPrice,
        pnlPctBefore: currentPnL,
        leverage: pos.leverage,
        orderId: result.orderId,
        source: 'bot',
      });
      log.ok(`✔ TAKE-PROFIT executed successfully for ${pos.symbol} (PnL: ${currentPnL.toFixed(2)}%)`, result);
    }
  }

  private async handleRebuy(pos: Position, spec: InstrumentSpec, currentPnL: number, config: BotConfig): Promise<void> {
    if (config.manualMode) {
      log.info(`[Manual Mode] DCA Rebuy trigger met for ${pos.symbol} (PnL: ${currentPnL.toFixed(2)}%). Skipping automatic order execution.`);
      return;
    }

    const { skip, reason } = this.shouldSkipRebuy(pos, config, currentPnL);
    if (skip) {
      log.info(reason);
      return;
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
      this.executionStore.set(pos.symbol, pos.markPrice, pos.side);

      // Calculate new avg price after DCA
      const newSize = pos.size + qty;
      const newAvgPrice = ((pos.size * pos.avgPrice) + (qty * pos.markPrice)) / newSize;

      await this.executionStore.recordOperation({
        symbol: pos.symbol,
        side: pos.side,
        action: 'DCA_REBUY',
        qty,
        price: pos.markPrice,
        avgPriceBefore: pos.avgPrice,
        avgPriceAfter: newAvgPrice,
        pnlPctBefore: currentPnL,
        marginUsed: marginNeeded,
        leverage: pos.leverage,
        orderId: result.orderId,
        source: 'bot',
      });
      log.ok(`✔ DCA REBUY executed successfully for ${pos.symbol} (PnL: ${currentPnL.toFixed(2)}%)`, result);
    }
  }

  private async executeNewEntry(symbol: string, lastPrice: number, spec: InstrumentSpec, config: BotConfig): Promise<boolean> {
    if (config.manualMode) {
      log.info(`[Manual Mode] Entry signal triggered for ${symbol}. Skipping automatic order execution.`);
      return false;
    }
    const targetMargin = Math.min(
      config.balance * (config.maxAllocPct / 100),
      config.balance * 0.05,
      50
    );
    const targetNotional = targetMargin * config.leverage;
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
      // FIX: Record the entry in execution store to prevent buy loops
      this.executionStore.set(symbol, lastPrice, 'Buy');
      await this.executionStore.recordOperation({
        symbol,
        side: 'Buy',
        action: 'ENTRY',
        qty,
        price: lastPrice,
        marginUsed: marginNeeded,
        leverage: config.leverage,
        orderId: result.orderId,
        source: 'bot',
      });
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
