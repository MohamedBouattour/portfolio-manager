import { calcMACD, isBullishCrossUnderZero } from '../utils/indicators.js';

export interface Strategy {
  name: string;
  evaluate(closes: number[]): { shouldEnter: boolean; latestValues?: any };
}

export class MACDStrategy implements Strategy {
  public readonly name = 'MACD Cross Under 0';

  constructor(
    private fastPeriod = 12,
    private slowPeriod = 26,
    private signalPeriod = 9
  ) {}

  /**
   * Evaluate if a given series of close prices triggers a bullish crossover below 0.
   */
  public evaluate(closes: number[]): { shouldEnter: boolean; latestValues?: any } {
    if (closes.length < this.slowPeriod + this.signalPeriod) {
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
