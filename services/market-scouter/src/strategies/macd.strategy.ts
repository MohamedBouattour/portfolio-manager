import type { IScoutStrategy, StrategyResult } from './strategy.interface.js';

export interface MACDPoint {
  macd: number;
  signal: number;
  histogram: number;
}

export const MIN_MACD_CANDLES = 10;

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

export function calcMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDPoint[] {
  if (closes.length < 2) {
    return [];
  }

  const fastEma = ema(closes, fastPeriod);
  const slowEma = ema(closes, slowPeriod);

  const macdLine = fastEma.map((f, i) => f - slowEma[i]);
  const signalLine = ema(macdLine, signalPeriod);

  return macdLine.map((m, i) => ({
    macd: m,
    signal: signalLine[i],
    histogram: m - signalLine[i],
  }));
}

export function isBullishCrossUnderZero(points: MACDPoint[], totalCandles?: number): boolean {
  if (points.length < 2) return false;

  const dataLen = totalCandles ?? points.length;
  if (dataLen < MIN_MACD_CANDLES) return false;

  const prev = points[points.length - 2];
  const curr = points[points.length - 1];

  const crossedUp = prev.macd < prev.signal && curr.macd >= curr.signal;
  const belowZero = curr.macd < 0 && curr.signal < 0;

  return crossedUp && belowZero;
}

/**
 * Calculate a confidence score (0-100) for the MACD signal.
 *
 * Factors:
 * - Histogram momentum (positive and increasing = strong)
 * - Proximity to the zero line (closer = stronger reversal potential)
 * - Crossover recency (just crossed = highest confidence)
 * - Histogram acceleration (histogram growing faster = more conviction)
 */
function calcMACDConfidence(points: MACDPoint[], totalCandles: number): number {
  if (points.length < 3 || totalCandles < MIN_MACD_CANDLES) return 0;

  const curr = points[points.length - 1];
  const prev = points[points.length - 2];
  const prev2 = points[points.length - 3];

  let score = 0;

  // 1. Crossover detection (max 35 pts)
  const justCrossed = prev.macd < prev.signal && curr.macd >= curr.signal;
  const nearCross = (curr.macd - curr.signal) >= 0 && Math.abs(curr.macd - curr.signal) < Math.abs(curr.macd) * 0.1;
  const approaching = curr.histogram > prev.histogram && curr.histogram < 0;

  if (justCrossed) {
    score += 35;
  } else if (nearCross && curr.histogram > 0) {
    score += 25;
  } else if (approaching) {
    score += 15;
  }

  // 2. Below zero (reversal from oversold — max 20 pts)
  if (curr.macd < 0 && curr.signal < 0) {
    // Deeper below zero = more room to recover
    const depth = Math.min(Math.abs(curr.macd) / (Math.abs(curr.macd) + 0.01), 1);
    score += Math.round(depth * 20);
  }

  // 3. Histogram momentum (max 25 pts)
  const histAccel = curr.histogram - prev.histogram;
  const prevHistAccel = prev.histogram - prev2.histogram;
  if (histAccel > 0) {
    score += 15;
    if (histAccel > prevHistAccel) {
      score += 10; // Accelerating
    }
  }

  // 4. Data sufficiency bonus (max 20 pts)
  // More data = more reliable signal
  const dataSufficiency = Math.min(totalCandles / 50, 1);
  score += Math.round(dataSufficiency * 20);

  return Math.min(score, 100);
}

export class MACDStrategy implements IScoutStrategy {
  public readonly name = 'MACD';

  constructor(
    private fastPeriod = 12,
    private slowPeriod = 26,
    private signalPeriod = 9
  ) {}

  public evaluate(closes: number[]): StrategyResult {
    if (closes.length < 2) {
      return { shouldEnter: false, confidence: 0, strategyName: this.name, details: {} };
    }

    const points = calcMACD(closes, this.fastPeriod, this.slowPeriod, this.signalPeriod);
    if (points.length === 0) {
      return { shouldEnter: false, confidence: 0, strategyName: this.name, details: {} };
    }

    const latest = points[points.length - 1];
    const shouldEnter = isBullishCrossUnderZero(points);
    const confidence = calcMACDConfidence(points, closes.length);

    return {
      shouldEnter,
      confidence,
      strategyName: this.name,
      details: {
        macd: latest.macd,
        signal: latest.signal,
        histogram: latest.histogram,
      },
    };
  }
}
