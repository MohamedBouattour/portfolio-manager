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

export function parseNumericEnv(val: string | undefined, defaultValue: number): number {
  if (!val) return defaultValue;
  
  let clean = val.replace(/\s+/g, '');
  
  if (clean.includes(',') && !clean.includes('.')) {
    // If there is a comma and NO dots, treat comma as a decimal point.
    clean = clean.replace(/,/g, '.');
  } else if (clean.includes(',') && clean.includes('.')) {
    // If there is both a comma and a dot, remove the comma (thousands separator).
    clean = clean.replace(/,/g, '');
  }

  if (/^[0-9.+\-*/()]+$/.test(clean)) {
    try {
      const result = new Function(`return (${clean});`)();
      if (typeof result === 'number' && !isNaN(result)) {
        return result;
      }
    } catch (e) {
      // Ignore evaluation error and fall back
    }
  }

  const parsed = parseFloat(clean);
  return isNaN(parsed) ? defaultValue : parsed;
}

