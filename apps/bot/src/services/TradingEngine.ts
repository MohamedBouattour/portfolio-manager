import { Exchange, BotConfig, Position, InstrumentSpec } from '../types/index.js';
import { Strategy } from '../strategies/MACDStrategy.js';
import { roundQty } from '../utils/math.js';
import { log } from '../utils/logger.js';

export class TradingEngine {
  constructor(
    private exchange: Exchange,
    private config: BotConfig,
    private strategy: Strategy
  ) {}

  /**
   * Run the full execution cycle:
   * 1. Validate symbols (discard any symbols not supported by the exchange)
   * 2. Manage existing positions (take profit or rebuy/DCA)
   * 3. Scout for new entries using the strategy
   */
  public async run(): Promise<void> {
    log.sep();
    log.info('Starting Trading Engine Execution Cycle...');
    log.info(`Account Balance: $${this.config.balance} | Leverage: ${this.config.leverage}x`);
    log.info(`TP: +${this.config.profitThresholdPct}% | DCA Rebuy: -${this.config.rebuyThresholdPct}% (reduce: ${this.config.reducePct}%)`);

    // 1. Determine target symbols
    let symbolsToProcess = this.config.stockSymbols;
    if (symbolsToProcess.length === 1 && symbolsToProcess[0] === 'ALL') {
      log.info('STOCK_SYMBOLS is set to "ALL" (or empty). Fetching all active stock tokens dynamically...');
      symbolsToProcess = await this.exchange.getActiveStockSymbols();
    }

    // 2. Validate symbols
    const validSymbols = await this.validateSymbols(symbolsToProcess);
    if (validSymbols.length === 0) {
      log.warn('No valid symbols to process. Aborting run.');
      return;
    }

    // 2. Manage ongoing positions
    const openPositions = await this.managePositions();

    // 3. Scout for new positions
    await this.scoutEntries(validSymbols, openPositions);

    log.sep();
    log.ok('Trading Engine execution cycle completed successfully.');
  }

  /**
   * Verify which configured symbols are valid/active on the exchange.
   */
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

  /**
   * Manage active positions:
   * - Reduce position by reducePct when PnL >= profitThresholdPct
   * - Rebuy/DCA when PnL <= -rebuyThresholdPct
   */
  private async managePositions(): Promise<Position[]> {
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

      // 1. Take Profit trigger
      if (pnl >= this.config.profitThresholdPct) {
        log.ok(`[Scout Only] ${pos.symbol}: Take Profit trigger met at PnL: ${pnl.toFixed(2)}%. (No order placed)`);
      }
      // 2. Rebuy/DCA trigger
      else if (pnl <= -this.config.rebuyThresholdPct) {
        log.ok(`[Scout Only] ${pos.symbol}: DCA Rebuy trigger met at PnL: ${pnl.toFixed(2)}%. (No order placed)`);
      } else {
        log.info(`${pos.symbol}: no position action needed.`);
      }
    }

    return positions;
  }

  /**
   * Scout all valid symbols for entry signals.
   */
  private async scoutEntries(validSymbols: string[], openPositions: Position[]): Promise<void> {
    log.sep();
    log.info('── ENTRY SIGNAL SCOUTING ──');

    const activeHeldSymbols = new Set(openPositions.map((p) => p.symbol));
    let signalCount = 0;

    for (const symbol of validSymbols) {
      if (activeHeldSymbols.has(symbol)) {
        log.info(`${symbol}: already holding position. Skipping scout.`);
        continue;
      }

      // Fetch 200 candles (minimum needed for standard slow period + signal period + padding)
      const closes = await this.exchange.getCloses(symbol, this.config.interval, 200);
      if (closes.length < 2) {
        log.warn(`${symbol}: insufficient candle history (${closes.length} candles).`);
        continue;
      }

      const { shouldEnter, latestValues } = this.strategy.evaluate(closes);

      if (latestValues) {
        log.info(
          `[Scouting] ${symbol} | MACD: ${latestValues.macd.toFixed(4)} | Signal: ${latestValues.signal.toFixed(4)} | Hist: ${latestValues.histogram.toFixed(4)}`
        );
      }

      if (shouldEnter) {
        signalCount++;
        log.ok(`🚀 Strategy triggered entry signal for ${symbol}!`);
        log.info(`[Scout Only] Would open new LONG position for ${symbol} at close price $${closes[closes.length - 1]}.`);
      }
    }

    log.info(`Scouting phase complete. Found ${signalCount} signal(s).`);
  }

  /**
   * Helper to execute a take-profit/reduction order.
   */
  private async handleTakeProfit(pos: Position, spec: InstrumentSpec, currentPnL: number): Promise<void> {
    const rawReduceQty = pos.size * (this.config.reducePct / 100);
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

  /**
   * Helper to execute a DCA/rebuy order.
   */
  private async handleRebuy(pos: Position, spec: InstrumentSpec, currentPnL: number): Promise<void> {
    const targetNotional = this.config.balance * (this.config.maxAllocPct / 100);
    const rawRebuyQty = targetNotional / pos.markPrice;
    const qty = roundQty(rawRebuyQty, spec);

    if (qty <= 0) {
      log.warn(`${pos.symbol}: DCA rebuy qty (${rawRebuyQty.toFixed(4)}) is below exchange minimum (${spec.minQty}). Skipping Rebuy.`);
      return;
    }

    const marginNeeded = (qty * pos.markPrice) / this.config.leverage;
    if (marginNeeded > this.config.balance * 0.95) {
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

  /**
   * Helper to execute a new long order when strategy triggers.
   */
  private async executeNewEntry(symbol: string, lastPrice: number, spec: InstrumentSpec): Promise<boolean> {
    const targetNotional = this.config.balance * (this.config.maxAllocPct / 100) * this.config.leverage;
    const rawQty = targetNotional / lastPrice;
    const qty = roundQty(rawQty, spec);

    if (qty <= 0) {
      log.warn(`${symbol}: entry qty (${rawQty.toFixed(4)}) is below exchange minimum (${spec.minQty}). Skipping entry.`);
      return false;
    }

    const marginNeeded = (qty * lastPrice) / this.config.leverage;
    if (marginNeeded > this.config.balance * 0.95) {
      log.warn(`${symbol}: required margin ($${marginNeeded.toFixed(2)}) exceeds 95% of balance. Skipping entry.`);
      return false;
    }

    log.info(`Setting leverage to ${this.config.leverage}x for ${symbol}...`);
    const levOk = await this.exchange.setLeverage(symbol, this.config.leverage);
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

  /**
   * Calculate PnL percentage based on initial margin.
   */
  private calculatePnLPct(pos: Position): number {
    const initialMargin = pos.positionValue / pos.leverage;
    if (initialMargin === 0) return 0;
    return (pos.unrealisedPnl / initialMargin) * 100;
  }
}
