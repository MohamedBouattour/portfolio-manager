import { Injectable } from '@nestjs/common';
import { MACDStrategy } from '../strategies/macd.strategy.js';
import { RSIStrategy } from '../strategies/rsi.strategy.js';
import { VolumeSpikeStrategy } from '../strategies/volume-spike.strategy.js';
import { StrategyEvaluatorService } from './strategy-evaluator.service.js';
import { DEFAULT_STOCK_SYMBOLS } from '../strategies/constants.js';
import type { IScoutStrategy, StrategyResult } from '../strategies/strategy.interface.js';
import { getLogsDir } from '@portfolio/contracts/utils';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const CONNECTOR_URL = process.env.BYBIT_CONNECTOR_URL || 'http://localhost:3001';

/** Aggregated scouting result per symbol */
export interface ScoutResult {
  symbol: string;
  price: number;
  /** Overall composite confidence 0-100 */
  confidence: number;
  /** True if any strategy triggers an entry signal */
  shouldEnter: boolean;
  /** List of strategy names that triggered entry */
  triggeredStrategies: string[];
  /** Number of candles available */
  candleCount: number;
  /** MACD indicator values */
  macd: number;
  signal: number;
  histogram: number;
  /** RSI value (14-period) */
  rsi: number;
  /** Volume ratio vs 20-period average */
  volumeRatio: number;
  /** Per-strategy results for detailed display */
  strategyResults: StrategyResult[];
}

@Injectable()
export class ScoutingService {
  private cache: ScoutResult[] | null = null;
  private lastFetchTime = 0;
  private cachedTimeframe = '';

  private strategies: IScoutStrategy[] = [
    new MACDStrategy(12, 26, 9),
    new RSIStrategy(14, 30, 70),
    new VolumeSpikeStrategy(20, 2.0),
  ];

  constructor(private readonly evaluator: StrategyEvaluatorService) {}

  async getScoutingStatus(): Promise<ScoutResult[]> {
    const now = Date.now();
    const tf = 'D';
    if (this.cache && this.cachedTimeframe === tf && now - this.lastFetchTime < 60000) {
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
        symbols = [...DEFAULT_STOCK_SYMBOLS];
      }

      logWrite('ℹ', `Discovered ${symbols.length} active TradFi stock symbols.`);
      const strategyNames = this.strategies.map(s => s.name).join(', ');
      logWrite('ℹ', `Evaluating strategies [${strategyNames}] on 1D (Daily) interval...`);

      const minCandles = this.evaluator.getMinCandles();

      const results = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const res = await axios.get(`${CONNECTOR_URL}/api/klines`, {
              params: {
                symbol,
                interval: 'D',
                limit: 100,
              }
            });

            const klines = res.data;
            if (!Array.isArray(klines) || klines.length < 2) return null;

            const latestClose = klines[klines.length - 1].close;
            const closes = klines.map((k: any) => k.close);
            const volumes = klines.map((k: any) => k.volume ?? 0);

            // Run all strategies
            const strategyResults: StrategyResult[] = this.strategies.map(strategy =>
              strategy.evaluate(closes, volumes)
            );

            // Aggregate results
            const triggeredStrategies = strategyResults
              .filter(r => r.shouldEnter)
              .map(r => r.strategyName);

            const shouldEnter = triggeredStrategies.length > 0;

            // Composite confidence: weighted average of all strategy confidences
            // Strategies that triggered get 2x weight
            let totalWeight = 0;
            let weightedConfidence = 0;
            for (const sr of strategyResults) {
              const weight = sr.shouldEnter ? 2 : 1;
              weightedConfidence += sr.confidence * weight;
              totalWeight += weight;
            }
            const compositeConfidence = totalWeight > 0 ? Math.round(weightedConfidence / totalWeight) : 0;

            // Extract specific indicator values for display
            const macdResult = strategyResults.find(r => r.strategyName === 'MACD');
            const rsiResult = strategyResults.find(r => r.strategyName === 'RSI');
            const volumeResult = strategyResults.find(r => r.strategyName === 'Volume');

            if (closes.length < minCandles) {
              logWrite('⚠', `[Scout] ${symbol} | Only ${closes.length} candles (min ${minCandles} required) — signals unreliable, skipping.`);
            } else {
              const parts = [`Price: $${latestClose.toFixed(2)}`];
              if (macdResult) parts.push(`MACD: ${macdResult.details.macd?.toFixed(4) ?? 'N/A'}`);
              if (rsiResult) parts.push(`RSI: ${rsiResult.details.rsi?.toFixed(1) ?? 'N/A'}`);
              if (volumeResult) parts.push(`VolR: ${volumeResult.details.volumeRatio?.toFixed(1) ?? 'N/A'}x`);
              parts.push(`Conf: ${compositeConfidence}%`);
              logWrite('ℹ', `[Scout] ${symbol} | ${parts.join(' | ')}`);
            }

            if (shouldEnter) {
              logWrite('✔', `🚀 ENTRY SIGNAL for ${symbol} via [${triggeredStrategies.join(', ')}] (Confidence: ${compositeConfidence}%)`);
              logWrite('ℹ', `[Scout Only] Would open new LONG position for ${symbol} at close price $${latestClose.toFixed(2)}.`);
            }

            return {
              symbol,
              price: latestClose,
              confidence: compositeConfidence,
              shouldEnter,
              triggeredStrategies,
              candleCount: closes.length,
              macd: macdResult?.details.macd ?? 0,
              signal: macdResult?.details.signal ?? 0,
              histogram: macdResult?.details.histogram ?? 0,
              rsi: rsiResult?.details.rsi ?? 0,
              volumeRatio: volumeResult?.details.volumeRatio ?? 0,
              strategyResults,
            } satisfies ScoutResult;
          } catch (e: any) {
            logWrite('✖', `Error evaluating ${symbol}: ${e.message}`);
          }
          return null;
        })
      );

      const filteredResults = results.filter((r): r is ScoutResult => r !== null);

      // Sort by confidence descending
      filteredResults.sort((a, b) => b.confidence - a.confidence);

      this.cache = filteredResults;
      this.lastFetchTime = now;
      this.cachedTimeframe = tf;

      const entryCount = filteredResults.filter(r => r.shouldEnter).length;
      const nearSignalCount = filteredResults.filter(r => !r.shouldEnter && r.confidence >= 40).length;
      logWrite('✔', `Scouting completed. ${entryCount} entry signals, ${nearSignalCount} near-signal assets.`);

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
