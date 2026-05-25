import { describe, it, expect } from 'vitest';
import { getStepDecimals, roundQty, roundPrice } from './math.js';
import { InstrumentSpec } from '../types/index.js';

const makeSpec = (overrides: Partial<InstrumentSpec> = {}): InstrumentSpec => ({
  symbol: 'TEST',
  minQty: 0.01,
  maxQty: 999999,
  qtyStep: 0.01,
  tickSize: 0.01,
  minPrice: 0.01,
  maxPrice: 999999,
  minNotional: 5,
  ...overrides,
});

describe('getStepDecimals', () => {
  it('should return 0 for integer step', () => {
    expect(getStepDecimals(1)).toBe(0);
  });

  it('should return correct decimals for fractional step', () => {
    expect(getStepDecimals(0.01)).toBe(2);
    expect(getStepDecimals(0.001)).toBe(3);
    expect(getStepDecimals(0.5)).toBe(1);
  });

  it('should handle large numbers', () => {
    expect(getStepDecimals(100)).toBe(0);
  });
});

describe('roundQty', () => {
  it('should round down to nearest step', () => {
    const spec = makeSpec({ qtyStep: 0.1 });
    expect(roundQty(1.27, spec)).toBe(1.2);
  });

  it('should return 0 if below minQty', () => {
    const spec = makeSpec({ qtyStep: 1, minQty: 1 });
    expect(roundQty(0.5, spec)).toBe(0);
  });

  it('should cap at maxQty', () => {
    const spec = makeSpec({ qtyStep: 1, maxQty: 10 });
    expect(roundQty(100, spec)).toBe(10);
  });

  it('should handle exact multiples', () => {
    const spec = makeSpec({ qtyStep: 0.5 });
    expect(roundQty(2.5, spec)).toBe(2.5);
  });

  it('should round with large step size', () => {
    const spec = makeSpec({ qtyStep: 10 });
    expect(roundQty(27, spec)).toBe(20);
  });
});

describe('roundPrice', () => {
  it('should round to nearest tick', () => {
    const spec = makeSpec({ tickSize: 0.05 });
    expect(roundPrice(10.12, spec)).toBe(10.1);
  });

  it('should round up correctly', () => {
    const spec = makeSpec({ tickSize: 0.01 });
    expect(roundPrice(10.125, spec)).toBe(10.13);
  });

  it('should handle integer tick size', () => {
    const spec = makeSpec({ tickSize: 1 });
    expect(roundPrice(10.5, spec)).toBe(11);
  });
});
