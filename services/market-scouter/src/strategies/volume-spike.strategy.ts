import type { IScoutStrategy, StrategyResult } from './strategy.interface.js';

const MIN_VOLUME_CANDLES = 21;
const DEFAULT_LOOKBACK = 20;
const DEFAULT_SPIKE_MULTIPLIER = 2.0;

/**
 * Calculate the simple moving average of an array.
 */
function sma(values: number[], period: number): number {
  if (values.length < period) return 0;
  const slice = values.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / period;
}

/**
 * Volume Spike Strategy
 *
 * Signal: Volume exceeds 2x the 20-period average AND the latest candle
 * is bullish (close > open, approximated by close > previous close).
 *
 * The rationale: a sudden volume surge on a green candle after a decline
 * often signals institutional buying / accumulation.
 *
 * Confidence factors:
 * - Volume spike magnitude (2x = baseline, 3x+ = very strong)
 * - Price action (bullish candle accompaniment)
 * - Context (was the asset declining before? recovery signals are stronger)
 */
export class VolumeSpikeStrategy implements IScoutStrategy {
  public readonly name = 'Volume';

  constructor(
    private lookback = DEFAULT_LOOKBACK,
    private spikeMultiplier = DEFAULT_SPIKE_MULTIPLIER
  ) {}

  public evaluate(closes: number[], volumes?: number[]): StrategyResult {
    const empty: StrategyResult = {
      shouldEnter: false,
      confidence: 0,
      strategyName: this.name,
      details: {},
    };

    if (!volumes || volumes.length < MIN_VOLUME_CANDLES) return empty;
    if (closes.length < MIN_VOLUME_CANDLES) return empty;

    const currentVolume = volumes[volumes.length - 1];
    const currentClose = closes[closes.length - 1];
    const prevClose = closes[closes.length - 2];

    // Average volume over lookback period (excluding the current bar)
    const avgVolume = sma(volumes.slice(0, -1), this.lookback);
    if (avgVolume === 0) return empty;

    const volumeRatio = currentVolume / avgVolume;
    const isBullishCandle = currentClose > prevClose;
    const isVolumeSpike = volumeRatio >= this.spikeMultiplier;

    // Check for prior decline (close was falling over last 3-5 candles)
    const recentCloses = closes.slice(-6, -1); // last 5 closes before current
    const wasDecline =
      recentCloses.length >= 3 &&
      recentCloses[recentCloses.length - 1] < recentCloses[0];

    const shouldEnter = isVolumeSpike && isBullishCandle;

    // Calculate confidence
    let confidence = 0;

    if (isVolumeSpike && isBullishCandle) {
      // Base signal (max 35 pts)
      confidence = 35;

      // Volume magnitude bonus (max 30 pts)
      // 2x = 0 bonus, 3x = 15, 4x+ = 30
      const magnitudeBonus = Math.min(Math.round((volumeRatio - this.spikeMultiplier) * 15), 30);
      confidence += magnitudeBonus;

      // Price recovery bonus (max 20 pts)
      const priceChange = ((currentClose - prevClose) / prevClose) * 100;
      confidence += Math.min(Math.round(priceChange * 5), 20);

      // Prior decline context bonus (max 15 pts)
      if (wasDecline) {
        confidence += 15;
      }
    } else if (isVolumeSpike && !isBullishCandle) {
      // Volume spike on a red candle — possible capitulation, watch closely
      confidence = 15;
    } else if (volumeRatio >= this.spikeMultiplier * 0.7) {
      // Near-spike: volume is elevated but not quite 2x
      confidence = 10;
      if (isBullishCandle) confidence += 5;
    }

    return {
      shouldEnter,
      confidence: Math.min(confidence, 100),
      strategyName: this.name,
      details: {
        volumeRatio: parseFloat(volumeRatio.toFixed(2)),
        avgVolume: parseFloat(avgVolume.toFixed(0)),
        currentVolume: parseFloat(currentVolume.toFixed(0)),
      },
    };
  }
}
