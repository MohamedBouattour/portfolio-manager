import { describe, it, expect, beforeEach } from 'vitest';
import { calcMACD, isBullishCrossUnderZero, MIN_MACD_CANDLES } from './indicators.js';

describe('calcMACD', () => {
  it('should return empty array for fewer than 2 closes', () => {
    expect(calcMACD([])).toEqual([]);
    expect(calcMACD([100])).toEqual([]);
  });

  it('should return MACDPoints with correct shape', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.5) * 10);
    const result = calcMACD(closes);

    expect(result.length).toBe(closes.length);
    result.forEach(p => {
      expect(p).toHaveProperty('macd');
      expect(p).toHaveProperty('signal');
      expect(p).toHaveProperty('histogram');
      expect(typeof p.macd).toBe('number');
      expect(typeof p.signal).toBe('number');
      expect(typeof p.histogram).toBe('number');
    });
  });

  it('should have histogram equal to macd minus signal', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.random() * 10);
    const result = calcMACD(closes, 5, 13, 4);

    result.forEach(p => {
      expect(p.histogram).toBeCloseTo(p.macd - p.signal, 10);
    });
  });

  it('should use default periods 12, 26, 9', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i);
    const defaultResult = calcMACD(closes);
    const explicitResult = calcMACD(closes, 12, 26, 9);

    expect(defaultResult.length).toBe(explicitResult.length);
    defaultResult.forEach((p, i) => {
      expect(p.macd).toBeCloseTo(explicitResult[i].macd, 10);
    });
  });

  it('should produce bullish crossover with uptrend data', () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i * 0.3) * 5);
    const result = calcMACD(closes, 5, 13, 4);
    expect(result.length).toBe(40);

    const anyMatch = result.some((p, i) => i > 0 && result[i - 1].macd < result[i - 1].signal && p.macd >= p.signal);
    expect(typeof anyMatch).toBe('boolean');
  });
});

describe('isBullishCrossUnderZero', () => {
  const makePoints = (overrides?: Array<Partial<{ macd: number; signal: number; histogram: number }>>) => {
    const defaults = [
      { macd: -5, signal: -4, histogram: -1 },
      { macd: -3, signal: -3.5, histogram: 0.5 },
    ];
    return overrides
      ? overrides.map((o, i) => ({ ...defaults[i], ...o }))
      : defaults;
  };

  it('should return true for valid bullish cross under zero', () => {
    const points = makePoints([
      { macd: -2, signal: -1.5, histogram: -0.5 },
      { macd: -1, signal: -1.2, histogram: 0.2 },
    ]);
    expect(isBullishCrossUnderZero(points, MIN_MACD_CANDLES)).toBe(true);
  });

  it('should return false with fewer than 2 points', () => {
    expect(isBullishCrossUnderZero([{ macd: 0, signal: 0, histogram: 0 }])).toBe(false);
    expect(isBullishCrossUnderZero([])).toBe(false);
  });

  it('should return false when candle count is below MIN_MACD_CANDLES', () => {
    const points = makePoints([
      { macd: -2, signal: -1.5, histogram: -0.5 },
      { macd: -1, signal: -1.2, histogram: 0.2 },
    ]);
    expect(isBullishCrossUnderZero(points, 5)).toBe(false);
  });

  it('should return false when both values are above zero', () => {
    const points = makePoints([
      { macd: 1, signal: 2, histogram: -1 },
      { macd: 3, signal: 2.5, histogram: 0.5 },
    ]);
    expect(isBullishCrossUnderZero(points, MIN_MACD_CANDLES)).toBe(false);
  });

  it('should return false when no crossover occurs', () => {
    const points = makePoints([
      { macd: -3, signal: -2, histogram: -1 },
      { macd: -2.5, signal: -2.2, histogram: -0.3 },
    ]);
    expect(isBullishCrossUnderZero(points, MIN_MACD_CANDLES)).toBe(false);
  });

  it('should use points length as fallback for totalCandles', () => {
    const points = makePoints([
      { macd: -5, signal: -4, histogram: -1 },
      { macd: -3, signal: -3.5, histogram: 0.5 },
    ]);
    const longPoints = Array.from({ length: MIN_MACD_CANDLES }, (_, i) => ({
      macd: -5 + i * 0.5,
      signal: -4 + i * 0.3,
      histogram: -1 + i * 0.2,
    }));
    longPoints[8] = { macd: -1.5, signal: -1, histogram: -0.5 };
    longPoints[9] = { macd: -0.5, signal: -0.8, histogram: 0.3 };
    expect(isBullishCrossUnderZero(longPoints)).toBe(true);
  });
});
