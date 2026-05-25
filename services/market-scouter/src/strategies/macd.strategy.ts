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

export class MACDStrategy {
  public readonly name = 'MACD Cross Under 0';

  constructor(
    private fastPeriod = 12,
    private slowPeriod = 26,
    private signalPeriod = 9
  ) {}

  public evaluate(closes: number[]): { shouldEnter: boolean; latestValues?: any } {
    if (closes.length < 2) {
      return { shouldEnter: false };
    }

    const points = calcMACD(closes, this.fastPeriod, this.slowPeriod, this.signalPeriod);
    if (points.length === 0) {
      return { shouldEnter: false };
    }

    const latest = points[points.length - 1];
    const shouldEnter = isBullishCrossUnderZero(points);

    return {
      shouldEnter,
      latestValues: {
        macd: latest.macd,
        signal: latest.signal,
        histogram: latest.histogram,
      },
    };
  }
}
