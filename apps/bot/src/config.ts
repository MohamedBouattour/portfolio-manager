import dotenv from 'dotenv';
import { BotConfig } from './types/index.js';

dotenv.config();

function reqEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

export const CFG: BotConfig = {
  apiKey: reqEnv('API_KEY'),
  secretKey: reqEnv('SECRET_KEY'),

  /** Bybit kline interval string – D = 1 Day */
  interval: process.env.TIME_FRAME ?? 'D',

  balance: parseFloat(process.env.BALANCE ?? '689'),
  leverage: parseInt(process.env.LEVERAGE ?? '3', 10),
  feePct: parseFloat(process.env.FEE_PCT ?? '0.04'),

  /** +X % unrealised PnL → take-profit trigger */
  profitThresholdPct: parseFloat(process.env.PROFIT_THRESHOLD_PCT ?? '15'),
  /** –X % unrealised PnL → rebuy trigger */
  rebuyThresholdPct: parseFloat(process.env.REBUY_THRESHOLD_PCT ?? '15'),
  /** % of position to close on take-profit */
  reducePct: parseFloat(process.env.POSITION_REDUCE_PCT ?? '15'),

  /** Max allocation per symbol as fraction of BALANCE */
  maxAllocPct: parseFloat(process.env.MAX_ALLOC_PCT ?? '20'),

  /** Comma-separated stock-token perpetual symbols or 'ALL' to fetch dynamically */
  stockSymbols: (() => {
    const raw = process.env.STOCK_SYMBOLS;
    if (!raw || raw.trim().toUpperCase() === 'ALL') {
      return ['ALL'];
    }
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  })(),
};
