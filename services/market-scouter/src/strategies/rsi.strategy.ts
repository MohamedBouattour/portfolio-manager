import type { IScoutStrategy, StrategyResult } from './strategy.interface.js';

const MIN_RSI_CANDLES = 15;
const DEFAULT_PERIOD = 14;
const OVERSOLD_THRESHOLD = 30;
const OVERBOUGHT_THRESHOLD = 70;

/**
 * Calculate RSI values for a price series.
 * Uses Wilder's smoothed moving average method.
 */
export function calcRSI(closes: number[], period = DEFAULT_PERIOD): number[] {
  if (closes.length < period + 1) return [];

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  // Initial average gain/loss over `period` changes
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] >= 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  const rsiValues: number[] = [];

  // First RSI value
  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsiValues.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs0));

  // Subsequent RSI values using Wilder's smoothing
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] >= 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
  }

  return rsiValues;
}

/**
 * RSI Oversold Bounce Strategy
 *
 * Signal: RSI crosses above 30 from below (exiting oversold territory).
 * This indicates a potential reversal / recovery from a sell-off.
 *
 * Confidence factors:
 * - How deep the RSI dipped below 30 (deeper = stronger recovery potential)
 * - Velocity of RSI recovery (faster = more conviction)
 * - Current RSI value (just above 30 = fresh signal)
 */
export class RSIStrategy implements IScoutStrategy {
  public readonly name = 'RSI';

  constructor(
    private period = DEFAULT_PERIOD,
    private oversoldThreshold = OVERSOLD_THRESHOLD,
    private overboughtThreshold = OVERBOUGHT_THRESHOLD
  ) {}

  public evaluate(closes: number[]): StrategyResult {
    const empty: StrategyResult = {
      shouldEnter: false,
      confidence: 0,
      strategyName: this.name,
      details: {},
    };

    if (closes.length < MIN_RSI_CANDLES) return empty;

    const rsiValues = calcRSI(closes, this.period);
    if (rsiValues.length < 2) return empty;

    const currRSI = rsiValues[rsiValues.length - 1];
    const prevRSI = rsiValues[rsiValues.length - 2];

    // Detect crossover above oversold threshold
    const crossedAboveOversold =
      prevRSI < this.oversoldThreshold && currRSI >= this.oversoldThreshold;

    // Find minimum RSI in recent window (last 5 RSI values)
    const recentWindow = rsiValues.slice(-5);
    const minRecentRSI = Math.min(...recentWindow);

    // Calculate confidence
    let confidence = 0;

    if (crossedAboveOversold) {
      // Base signal detected — start at 40
      confidence = 40;

      // Depth bonus: how deep did RSI go? (max 25 pts)
      // RSI of 10 is deeply oversold; RSI of 28 is barely oversold
      const depth = Math.max(0, this.oversoldThreshold - minRecentRSI);
      confidence += Math.min(Math.round(depth * 1.25), 25);

      // Recovery velocity: how fast did RSI bounce? (max 20 pts)
      const velocity = currRSI - prevRSI;
      confidence += Math.min(Math.round(velocity * 2), 20);

      // Freshness: signal is strongest right at the crossover (max 15 pts)
      const distAboveThreshold = currRSI - this.oversoldThreshold;
      const freshness = Math.max(0, 15 - distAboveThreshold);
      confidence += Math.round(freshness);
    } else if (currRSI < this.oversoldThreshold) {
      // Currently oversold but no cross yet — near signal
      confidence = 15;
      const depth = this.oversoldThreshold - currRSI;
      confidence += Math.min(Math.round(depth * 0.8), 20);
    } else if (currRSI < this.oversoldThreshold + 10 && prevRSI < currRSI) {
      // Recently was near oversold, trending up — low confidence
      confidence = 10;
    }

    return {
      shouldEnter: crossedAboveOversold,
      confidence: Math.min(confidence, 100),
      strategyName: this.name,
      details: {
        rsi: currRSI,
        prevRsi: prevRSI,
        minRecentRsi: minRecentRSI,
      },
    };
  }
}
