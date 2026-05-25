import { Injectable } from '@nestjs/common';
import { MACDStrategy } from '../strategies/macd.strategy.js';
import { StrategyEvaluatorService } from './strategy-evaluator.service.js';
import { getLogsDir } from '@portfolio/contracts/utils';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const CONNECTOR_URL = process.env.BYBIT_CONNECTOR_URL || 'http://localhost:3001';
const DEFAULT_TIMEFRAME = process.env.TIME_FRAME ?? '240';

@Injectable()
export class ScoutingService {
  private cache: any = null;
  private lastFetchTime = 0;

  constructor(private readonly evaluator: StrategyEvaluatorService) {}

  async getScoutingStatus() {
    const now = Date.now();
    if (this.cache && now - this.lastFetchTime < 60000) {
      return this.cache;
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
      let symbols: string[] = [];
      try {
        const symRes = await axios.get(`${CONNECTOR_URL}/api/symbols?type=stock`);
        symbols = symRes.data;
      } catch (err: any) {
        console.error('[MarketScouter] Error fetching symbols from connector, using fallback:', err.message);
        symbols = [
          'AAPLUSDT', 'TSLAUSDT', 'NVDAUSDT', 'AMZNUSDT', 'GOOGLUSDT',
          'MSFTUSDT', 'METAUSDT', 'COINUSDT', 'MSTRUSDT', 'AMDUSDT',
          'INTCUSDT', 'PLTRUSDT', 'QQQUSDT', 'SPYUSDT', 'TSMUSDT',
        ];
      }

      logWrite('ℹ', `Discovered ${symbols.length} active TradFi stock symbols.`);
      const strategy = new MACDStrategy(12, 26, 9);
      const tfName = DEFAULT_TIMEFRAME === 'D' ? '1D' : DEFAULT_TIMEFRAME === '240' ? '4h' : DEFAULT_TIMEFRAME === '60' ? '1h' : DEFAULT_TIMEFRAME;
      logWrite('ℹ', `Evaluating MACD (12, 26, 9) crossover strategy on ${tfName} interval...`);

      const minCandles = this.evaluator.getMinCandles();

      const results = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const res = await axios.get(`${CONNECTOR_URL}/api/klines`, {
              params: {
                symbol,
                interval: DEFAULT_TIMEFRAME,
                limit: 100,
              }
            });

            const klines = res.data;
            if (Array.isArray(klines) && klines.length >= 2) {
              const latestClose = klines[klines.length - 1].close;
              const closes = klines.map((k: any) => k.close);
              const { shouldEnter, latestValues } = strategy.evaluate(closes);

              if (closes.length < minCandles) {
                logWrite('⚠', `[Scout] ${symbol} | Only ${closes.length} candles (min ${minCandles} required) — MACD unreliable, skipping signal.`);
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
      this.cache = filteredResults;
      this.lastFetchTime = now;

      logWrite('✔', `Scouting run completed. Found ${filteredResults.filter(r => r.shouldEnter).length} potential uptrends.`);

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
      throw err;
    }
  }
}
