import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('dotenv', () => ({
  default: { config: vi.fn() },
  config: vi.fn(),
}));

vi.mock('fs', () => ({
  default: { existsSync: vi.fn() },
  existsSync: vi.fn(() => false),
}));

const envBackup: Record<string, string | undefined> = {};
const ENV_KEYS = ['API_KEY', 'SECRET_KEY', 'TIME_FRAME', 'BALANCE', 'LEVERAGE',
  'FEE_PCT', 'PROFIT_THRESHOLD_PCT', 'REBUY_THRESHOLD_PCT',
  'POSITION_REDUCE_PCT', 'MAX_ALLOC_PCT', 'STOCK_SYMBOLS', 'DRY_RUN', 'MANUAL_MODE'];

beforeEach(() => {
  ENV_KEYS.forEach(k => { envBackup[k] = process.env[k]; delete process.env[k]; });
  process.env.API_KEY = 'test-api-key';
  process.env.SECRET_KEY = 'test-secret-key';
  vi.resetModules();
});

afterEach(() => {
  ENV_KEYS.forEach(k => {
    if (envBackup[k] !== undefined) process.env[k] = envBackup[k];
    else delete process.env[k];
  });
});

describe('CFG config', () => {
  it('should load from env vars with defaults', async () => {
    const { CFG } = await import('./config.js');
    expect(CFG.apiKey).toBe('test-api-key');
    expect(CFG.secretKey).toBe('test-secret-key');
    expect(CFG.interval).toBe('D');
    expect(CFG.balance).toBe(689);
    expect(CFG.leverage).toBe(3);
    expect(CFG.feePct).toBe(0.04);
    expect(CFG.profitThresholdPct).toBe(15);
    expect(CFG.rebuyThresholdPct).toBe(15);
    expect(CFG.reducePct).toBe(15);
    expect(CFG.maxAllocPct).toBe(20);
    expect(CFG.stockSymbols).toEqual(['ALL']);
    expect(CFG.dryRun).toBe(true);
    expect(CFG.manualMode).toBe(false);
  });

  it('should parse custom env values', async () => {
    process.env.TIME_FRAME = '240';
    process.env.BALANCE = '1000';
    process.env.LEVERAGE = '5';
    process.env.FEE_PCT = '0.1';
    process.env.PROFIT_THRESHOLD_PCT = '25';
    process.env.REBUY_THRESHOLD_PCT = '20';
    process.env.POSITION_REDUCE_PCT = '30';
    process.env.MAX_ALLOC_PCT = '50';
    process.env.STOCK_SYMBOLS = 'AAPLUSDT,TSLAUSDT,NVDAUSDT';
    process.env.DRY_RUN = 'false';
    process.env.MANUAL_MODE = 'true';

    const { CFG } = await import('./config.js');
    expect(CFG.interval).toBe('240');
    expect(CFG.balance).toBe(1000);
    expect(CFG.leverage).toBe(5);
    expect(CFG.feePct).toBe(0.1);
    expect(CFG.profitThresholdPct).toBe(25);
    expect(CFG.rebuyThresholdPct).toBe(20);
    expect(CFG.reducePct).toBe(30);
    expect(CFG.maxAllocPct).toBe(50);
    expect(CFG.stockSymbols).toEqual(['AAPLUSDT', 'TSLAUSDT', 'NVDAUSDT']);
    expect(CFG.dryRun).toBe(false);
    expect(CFG.manualMode).toBe(true);
  });

  it('should parse STOCK_SYMBOLS=ALL as array with ALL', async () => {
    process.env.STOCK_SYMBOLS = 'ALL';
    const { CFG } = await import('./config.js');
    expect(CFG.stockSymbols).toEqual(['ALL']);
  });

  it('should parse empty STOCK_SYMBOLS as array with ALL', async () => {
    delete process.env.STOCK_SYMBOLS;
    const { CFG } = await import('./config.js');
    expect(CFG.stockSymbols).toEqual(['ALL']);
  });

  it('should parse single stock symbol', async () => {
    process.env.STOCK_SYMBOLS = 'BTCUSDT';
    const { CFG } = await import('./config.js');
    expect(CFG.stockSymbols).toEqual(['BTCUSDT']);
  });

  it('should trim whitespace from stock symbols', async () => {
    process.env.STOCK_SYMBOLS = ' AAPLUSDT , TSLAUSDT ';
    const { CFG } = await import('./config.js');
    expect(CFG.stockSymbols).toEqual(['AAPLUSDT', 'TSLAUSDT']);
  });

  it('should throw error if API_KEY is missing', async () => {
    delete process.env.API_KEY;
    await expect(import('./config.js')).rejects.toThrow('Missing required env var: API_KEY');
  });

  it('should throw error if SECRET_KEY is missing', async () => {
    delete process.env.SECRET_KEY;
    await expect(import('./config.js')).rejects.toThrow('Missing required env var: SECRET_KEY');
  });

  it('should set dryRun to true when DRY_RUN is not false', async () => {
    process.env.DRY_RUN = 'true';
    const { CFG } = await import('./config.js');
    expect(CFG.dryRun).toBe(true);
  });

  it('should set dryRun to false when DRY_RUN is false', async () => {
    process.env.DRY_RUN = 'false';
    const { CFG } = await import('./config.js');
    expect(CFG.dryRun).toBe(false);
  });

  it('should set dryRun to true when DRY_RUN is not set', async () => {
    delete process.env.DRY_RUN;
    const { CFG } = await import('./config.js');
    expect(CFG.dryRun).toBe(true);
  });
});
