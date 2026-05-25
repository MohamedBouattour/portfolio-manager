import { Controller, Get, Post, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { MACDStrategy, MIN_MACD_CANDLES } from 'bybit-stock-bot';
import { BybitService } from './bybit.service.js';
import * as fs from 'fs';
import * as path from 'path';

function getLogsDir() {
  let currentDir = process.cwd();
  while (currentDir) {
    const candidate = path.join(currentDir, 'logs');
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(currentDir, 'package.json'), 'utf8'));
        if (pkg.name === 'bybit-monorepo') {
          return candidate;
        }
      } catch (e) {}
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  return path.join(process.cwd(), 'logs');
}

const DEFAULT_TIMEFRAME = process.env.TIME_FRAME ?? '240';

@Controller('api')
export class AppController {
  private momentumCache: any = null;
  private lastFetchTime = 0;
  private scoutingCache: any = null;
  private lastScoutTime = 0;
  private stocksCache: string[] | null = null;
  private lastStocksFetch = 0;

  constructor(private readonly bybitService: BybitService) {}

  @Get('config')
  getConfig() {
    const isManual = process.env.MANUAL_MODE?.trim().toLowerCase() === 'true';
    console.log(`[Backend Config] Request received. timeframe: ${DEFAULT_TIMEFRAME}, MANUAL_MODE env: '${process.env.MANUAL_MODE}', parsed: ${isManual}`);
    return {
      timeframe: DEFAULT_TIMEFRAME,
      manualMode: isManual,
    };
  }

  @Get('stocks')
  async getStocks() {
    const now = Date.now();
    if (this.stocksCache && now - this.lastStocksFetch < 600000) {
      return this.stocksCache;
    }
    try {
      // Dynamic scanning of symbols
      const symbols = await this.bybitService.getActiveStockSymbols();
      if (symbols && symbols.length > 0) {
        this.stocksCache = symbols;
        this.lastStocksFetch = now;
        return symbols;
      }
      const fallback = [
        'AAPLUSDT', 'TSLAUSDT', 'NVDAUSDT', 'AMZNUSDT', 'GOOGLUSDT',
        'MSFTUSDT', 'METAUSDT', 'COINUSDT', 'MSTRUSDT', 'AMDUSDT',
        'INTCUSDT', 'PLTRUSDT', 'QQQUSDT', 'SPYUSDT', 'TSMUSDT',
      ];
      this.stocksCache = fallback;
      this.lastStocksFetch = now;
      return fallback;
    } catch (err: any) {
      const fallback = [
        'AAPLUSDT', 'TSLAUSDT', 'NVDAUSDT', 'AMZNUSDT', 'GOOGLUSDT',
        'MSFTUSDT', 'METAUSDT', 'COINUSDT', 'MSTRUSDT', 'AMDUSDT',
        'INTCUSDT', 'PLTRUSDT', 'QQQUSDT', 'SPYUSDT', 'TSMUSDT',
      ];
      this.stocksCache = fallback;
      this.lastStocksFetch = now;
      return fallback;
    }
  }

  @Get('klines')
  async getKlines(@Query('symbol') symbol: string, @Query('interval') interval = DEFAULT_TIMEFRAME) {
    if (!symbol) {
      throw new HttpException('Symbol query param is required', HttpStatus.BAD_REQUEST);
    }
    try {
      const limit = 200;
      const res = await this.bybitService.getKlines({
        symbol,
        interval: interval as any,
        limit,
      });

      if (res.retCode !== 0 || !res.result?.list?.length) {
        throw new HttpException(res.retMsg || 'Failed to fetch klines', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Map to standard format for front-end charts: time, open, high, low, close
      // Bybit kline list format: [startTime, openPrice, highPrice, lowPrice, closePrice, volume, turnover]
      // Sort chronologically (oldest to newest)
      const data = res.result.list
        .map((k: any) => ({
          time: parseInt(k[0]) / 1000, // Unix timestamp in seconds
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }))
        .reverse();

      return data;
    } catch (err: any) {
      throw new HttpException(err.message || 'Error fetching klines', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('evaluate')
  async evaluate(
    @Body()
    body: {
      closes: number[];
      index: number;
      position?: {
        side: 'Buy' | 'Sell';
        size: number;
        avgPrice: number;
        markPrice: number;
      };
      config?: {
        leverage: number;
        balance: number;
        profitThresholdPct: number;
        rebuyThresholdPct: number;
        reducePct: number;
        maxAllocPct: number;
      };
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
      // 1. Evaluate strategy at the specific index (up to index+1 closes)
      const historySlice = closes.slice(0, index + 1);
      const strategy = new MACDStrategy(12, 26, 9);
      const { shouldEnter, latestValues } = strategy.evaluate(historySlice);

      // 2. Evaluate position management rules at that step
      let positionDecision = {
        action: 'HOLD',
        qty: 0,
        reason: 'No action required or position not active.',
      };

      if (position) {
        const leverage = config?.leverage ?? 3;
        const balance = config?.balance ?? 1000;
        const profitThresholdPct = config?.profitThresholdPct ?? 15;
        const rebuyThresholdPct = config?.rebuyThresholdPct ?? 15;
        const reducePct = config?.reducePct ?? 15;
        const maxAllocPct = config?.maxAllocPct ?? 20;

        // Calculate current position PnL based on markPrice at the evaluation index
        const currentMarkPrice = closes[index];
        const rawPnl =
          position.side === 'Buy'
            ? (currentMarkPrice - position.avgPrice) * position.size
            : (position.avgPrice - currentMarkPrice) * position.size;

        const positionValue = position.size * position.avgPrice;
        const initialMargin = positionValue / leverage;
        const pnlPct = initialMargin > 0 ? (rawPnl / initialMargin) * 100 : 0;

        if (pnlPct >= profitThresholdPct) {
          const qtyToReduce = position.size * (reducePct / 100);
          positionDecision = {
            action: 'REDUCE',
            qty: parseFloat(qtyToReduce.toFixed(4)),
            reason: `Take Profit triggered. PnL is +${pnlPct.toFixed(2)}% >= +${profitThresholdPct}%. Reducing position size by ${reducePct}%.`,
          };
        } else if (pnlPct <= -rebuyThresholdPct) {
          const targetNotional = balance * (maxAllocPct / 100);
          const rawRebuyQty = targetNotional / currentMarkPrice;
          positionDecision = {
            action: 'DCA_REBUY',
            qty: parseFloat(rawRebuyQty.toFixed(4)),
            reason: `DCA Rebuy triggered. PnL is ${pnlPct.toFixed(2)}% <= -${rebuyThresholdPct}%. Adding position size.`,
          };
        } else {
          positionDecision = {
            action: 'HOLD',
            qty: 0,
            reason: `PnL is ${pnlPct.toFixed(2)}% (within [-${rebuyThresholdPct}%, +${profitThresholdPct}%]). Holding position.`,
          };
        }
      }

      return {
        stepIndex: index,
        evalPrice: closes[index],
        strategySignal: {
          shouldEnter,
          latestValues,
          macdValue: latestValues?.macd ?? 0,
          signalValue: latestValues?.signal ?? 0,
          histValue: latestValues?.histogram ?? 0,
        },
        positionDecision,
      };
    } catch (err: any) {
      throw new HttpException(err.message || 'Evaluation error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('scouting-status')
  async getScoutingStatus() {
    const now = Date.now();
    if (this.scoutingCache && now - this.lastScoutTime < 60000) {
      return this.scoutingCache;
    }

    const logLines: string[] = [];
    const logTimestamp = now;

    const logWrite = (icon: string, msg: string) => {
      const line = `[${new Date().toISOString()}] ${icon} ${msg}`;
      logLines.push(line);
      console.log(line);
    };

    logWrite('🚀', 'Starting Scouting evaluation cycle...');

    try {
      const symbols = await this.getStocks();
      logWrite('ℹ', `Discovered ${symbols.length} active TradFi stock symbols.`);
      const targetSymbols = symbols;
      const strategy = new MACDStrategy(12, 26, 9);
      const tfName = DEFAULT_TIMEFRAME === 'D' ? '1D' : DEFAULT_TIMEFRAME === '240' ? '4h' : DEFAULT_TIMEFRAME === '60' ? '1h' : DEFAULT_TIMEFRAME;
      logWrite('ℹ', `Evaluating MACD (12, 26, 9) crossover strategy on ${tfName} interval...`);

      const results = await Promise.all(
        targetSymbols.map(async (symbol) => {
          try {
            const res = await this.bybitService.getKlines({
              symbol,
              interval: DEFAULT_TIMEFRAME as any,
              limit: 100,
            });

            if (res.retCode === 0 && res.result?.list?.length >= 2) {
              const list = res.result.list;
              const latestClose = parseFloat(list[0][4]);
              const closes = list.map((k: any) => parseFloat(k[4])).reverse();
              const { shouldEnter, latestValues } = strategy.evaluate(closes);

              if (closes.length < MIN_MACD_CANDLES) {
                logWrite('⚠', `[Scout] ${symbol} | Only ${closes.length} candles (min ${MIN_MACD_CANDLES} required) — MACD unreliable, skipping signal.`);
              } else if (latestValues) {
                logWrite(
                  'ℹ',
                  `[Scout] ${symbol} | Price: $${latestClose.toFixed(2)} | MACD: ${latestValues.macd.toFixed(4)} | Hist: ${latestValues.histogram.toFixed(4)} | Signal: ${latestValues.signal.toFixed(4)}`
                );
              }

              if (shouldEnter) {
                logWrite('✔', `🚀 STRATEGY TRIGGERED ENTRY SIGNAL FOR ${symbol}!`);
                logWrite('ℹ', `[Scout Only] Would open new LONG position for ${symbol} at close price $${latestClose.toFixed(2)}.`);
              }

              return {
                symbol,
                price: latestClose,
                macd: latestValues?.macd ?? 0,
                signal: latestValues?.signal ?? 0,
                histogram: latestValues?.histogram ?? 0,
                shouldEnter,
                candleCount: closes.length,
              };
            }
          } catch (e: any) {
            logWrite('✖', `Error evaluating ${symbol}: ${e.message}`);
          }
          return null;
        })
      );

      const filteredResults = results.filter((r) => r !== null) as any[];
      this.scoutingCache = filteredResults;
      this.lastScoutTime = now;

      logWrite('✔', `Scouting run completed. Found ${filteredResults.filter(r => r.shouldEnter).length} potential uptrends.`);

      // Write logs to file
      try {
        const logsDir = getLogsDir();
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
        const logFilePath = path.join(logsDir, `${logTimestamp}.log`);
        fs.writeFileSync(logFilePath, logLines.join('\n'), 'utf8');
      } catch (logErr: any) {
        console.error('Failed to write backend scout log file:', logErr);
      }

      return filteredResults;
    } catch (err: any) {
      logWrite('✖', `Fatal scouting cycle error: ${err.message}`);
      throw new HttpException(err.message || 'Error getting scouting status', HttpStatus.INTERNAL_SERVER_ERROR);
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

  @Get('momentum')
  async getMomentum() {
    const now = Date.now();
    if (this.momentumCache && now - this.lastFetchTime < 120000) {
      return this.momentumCache;
    }

    try {
      const symbols = await this.getStocks();
      const targetSymbols = symbols.slice(0, 15);
      
      const results = await Promise.all(
        targetSymbols.map(async (symbol) => {
          try {
            const limit = 7; // 7 daily klines = 7 days
            const res = await this.bybitService.getKlines({
              symbol,
              interval: 'D',
              limit,
            });

            if (res.retCode === 0 && res.result?.list?.length > 1) {
              const list = res.result.list;
              const latestClose = parseFloat(list[0][4]);
              const oldestClose = parseFloat(list[list.length - 1][4]);
              const changePct = ((latestClose - oldestClose) / oldestClose) * 100;
              return {
                symbol,
                price: latestClose,
                changePct,
              };
            }
          } catch (e) {
            // Ignore error
          }
          return null;
        })
      );

      const momentumStocks = results
        .filter((r): r is { symbol: string; price: number; changePct: number } => r !== null && r.changePct > 0)
        .sort((a, b) => b.changePct - a.changePct);

      this.momentumCache = momentumStocks;
      this.lastFetchTime = now;
      return momentumStocks;
    } catch (err: any) {
      return [
        { symbol: 'AAPLUSDT', price: 292.40, changePct: 5.4 },
        { symbol: 'TSLAUSDT', price: 182.10, changePct: 12.8 },
        { symbol: 'NVDAUSDT', price: 915.20, changePct: 8.2 },
        { symbol: 'AMZNUSDT', price: 185.50, changePct: 3.1 },
        { symbol: 'GOOGLUSDT', price: 173.80, changePct: 2.4 },
      ];
    }
  }

  @Get('positions')
  async getPositions() {
    try {
      return await this.bybitService.getOpenPositions();
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
      const result = await this.bybitService.executeOrder({
        symbol,
        side,
        qty,
        reduceOnly,
        leverage,
      });
      if (!result) {
        throw new HttpException('Order submission failed on exchange', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return result;
    } catch (err: any) {
      throw new HttpException(err.message || 'Order execution error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
