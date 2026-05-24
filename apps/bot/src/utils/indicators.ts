/**
 * Lightweight MACD indicator – no external dependencies.
 */

export interface MACDPoint {
  macd: number;
  signal: number;
  histogram: number;
}

/**
 * Compute EMA array from a series of values.
 */
function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

/**
 * Calculate MACD (12, 26, 9) from close prices.
 * Returns array aligned with input (early values may be inaccurate).
 */
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

/**
 * Detect a bullish MACD crossover in negative territory.
 *
 * Condition (on the two most recent completed candles):
 *   prev: macd < signal  (both < 0)
 *   curr: macd >= signal  (both < 0)
 *
 * This is the "MACD cross under 0" pattern – a bullish momentum
 * shift while the trend is still in negative territory.
 */
export function isBullishCrossUnderZero(points: MACDPoint[]): boolean {
  if (points.length < 2) return false;

  // Use the two most recent *completed* candles (skip the live candle)
  const prev = points[points.length - 2];
  const curr = points[points.length - 1];

  const crossedUp = prev.macd < prev.signal && curr.macd >= curr.signal;
  const belowZero = curr.macd < 0 && curr.signal < 0;

  return crossedUp && belowZero;
}
