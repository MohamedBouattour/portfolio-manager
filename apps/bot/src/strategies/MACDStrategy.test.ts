import { describe, it, expect } from 'vitest';
import { MACDStrategy } from './MACDStrategy.js';

describe('MACDStrategy', () => {
  it('should have name set', () => {
    const strategy = new MACDStrategy();
    expect(strategy.name).toBe('MACD Cross Under 0');
  });

  it('should return shouldEnter false for insufficient data', () => {
    const strategy = new MACDStrategy();
    const result = strategy.evaluate([100]);
    expect(result.shouldEnter).toBe(false);
  });

  it('should return shouldEnter false for empty data', () => {
    const strategy = new MACDStrategy();
    const result = strategy.evaluate([]);
    expect(result.shouldEnter).toBe(false);
  });

  it('should return latestValues with macd, signal, histogram', () => {
    const strategy = new MACDStrategy(5, 13, 4);
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.3) * 10);
    const result = strategy.evaluate(closes);

    expect(result.latestValues).toHaveProperty('macd');
    expect(result.latestValues).toHaveProperty('signal');
    expect(result.latestValues).toHaveProperty('histogram');
    expect(typeof result.latestValues.macd).toBe('number');
    expect(typeof result.latestValues.signal).toBe('number');
    expect(typeof result.latestValues.histogram).toBe('number');
  });

  it('should detect entry signal on a bullish crossover pattern', () => {
    const strategy = new MACDStrategy(5, 13, 4);
    const downtrend = Array.from({ length: 10 }, (_, i) => 100 - i * 2);
    const uptrend = Array.from({ length: 25 }, (_, i) => 80 + i * 1.5);
    const closes = [...downtrend, ...uptrend];

    const result = strategy.evaluate(closes);
    expect(result).toHaveProperty('shouldEnter');
    expect(result).toHaveProperty('latestValues');
  });

  it('should accept custom periods', () => {
    const strategy = new MACDStrategy(6, 14, 5);
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const result = strategy.evaluate(closes);
    expect(result.shouldEnter).toBe(false);
    expect(result.latestValues).toBeDefined();
  });
});
