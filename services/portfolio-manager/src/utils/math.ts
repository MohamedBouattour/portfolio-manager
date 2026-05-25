import { InstrumentSpec } from '@portfolio/contracts';

export function getStepDecimals(step: number): number {
  const s = step.toString();
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

export function roundQty(raw: number, spec: InstrumentSpec): number {
  const step = spec.qtyStep;
  const rounded = Math.floor(raw / step) * step;
  const decimals = getStepDecimals(step);
  const fixed = parseFloat(rounded.toFixed(decimals));
  if (fixed < spec.minQty) return 0;
  return Math.min(fixed, spec.maxQty);
}

export function roundPrice(raw: number, spec: InstrumentSpec): number {
  const tick = spec.tickSize;
  const rounded = Math.round(raw / tick) * tick;
  const decimals = getStepDecimals(tick);
  return parseFloat(rounded.toFixed(decimals));
}
