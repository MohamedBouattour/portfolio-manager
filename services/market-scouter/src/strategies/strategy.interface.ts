/**
 * Standardized strategy evaluation result.
 * Every strategy must return this shape so the scouting service
 * can aggregate signals from multiple strategies uniformly.
 */
export interface StrategyResult {
  /** True when the strategy recommends opening a position */
  shouldEnter: boolean;

  /**
   * Confidence score 0-100.
   * 0  = no signal at all
   * 1-39  = weak / forming
   * 40-69 = near-signal (worth watching)
   * 70-100 = strong entry signal
   */
  confidence: number;

  /** Human-readable name of the strategy that produced this result */
  strategyName: string;

  /** Strategy-specific indicator values for display */
  details: Record<string, number>;
}

/**
 * Every scouting strategy must implement this interface.
 */
export interface IScoutStrategy {
  readonly name: string;

  /**
   * Evaluate a series of candle closes and return a signal result.
   * @param closes - Array of close prices (oldest first)
   * @param volumes - Optional array of volumes (oldest first)
   */
  evaluate(closes: number[], volumes?: number[]): StrategyResult;
}
