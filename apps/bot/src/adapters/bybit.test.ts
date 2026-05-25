import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGetPositionInfo, mockGetInstrumentsInfo, mockSubmitOrder, mockSetLeverage, mockGetKline } = vi.hoisted(() => ({
  mockGetPositionInfo: vi.fn(),
  mockGetInstrumentsInfo: vi.fn(),
  mockSubmitOrder: vi.fn(),
  mockSetLeverage: vi.fn(),
  mockGetKline: vi.fn(),
}));

vi.mock('bybit-api', () => ({
  RestClientV5: function () {
    return {
      getPositionInfo: mockGetPositionInfo,
      getInstrumentsInfo: mockGetInstrumentsInfo,
      submitOrder: mockSubmitOrder,
      setLeverage: mockSetLeverage,
      getKline: mockGetKline,
    };
  },
}));

vi.mock('../utils/logger.js', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    ok: vi.fn(),
  },
}));

import { BybitAdapter } from './bybit.js';

let adapter: BybitAdapter;

beforeEach(() => {
  vi.clearAllMocks();
  adapter = new BybitAdapter('key', 'secret');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getOpenPositions', () => {
  it('should return parsed positions on success', async () => {
    mockGetPositionInfo.mockResolvedValue({
      retCode: 0, retMsg: 'OK',
      result: {
        list: [
          { symbol: 'BTCUSDT', side: 'Buy', size: '0.5', avgPrice: '50000', markPrice: '51000', unrealisedPnl: '500', positionValue: '25000', leverage: '5' },
          { symbol: 'ETHUSDT', side: 'Sell', size: '0', avgPrice: '3000', markPrice: '3100', unrealisedPnl: '0', positionValue: '0', leverage: '3' },
        ],
      },
    });
    const result = await adapter.getOpenPositions();
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTCUSDT');
  });

  it('should return empty array on API error', async () => {
    mockGetPositionInfo.mockResolvedValue({ retCode: 10001, retMsg: 'Error' });
    expect(await adapter.getOpenPositions()).toEqual([]);
  });

  it('should return empty on exception', async () => {
    mockGetPositionInfo.mockRejectedValue(new Error('err'));
    expect(await adapter.getOpenPositions()).toEqual([]);
  });
});

describe('getInstrumentSpec', () => {
  const mockInfo = (overrides = {}) => ({
    retCode: 0,
    result: { list: [{ symbol: 'BTCUSDT', lotSizeFilter: { minOrderQty: '0.001', maxOrderQty: '1000', qtyStep: '0.001', minNotionalValue: '5' }, priceFilter: { tickSize: '0.5', minPrice: '0', maxPrice: '999999' }, ...overrides }] },
  });

  it('should return parsed spec', async () => {
    mockGetInstrumentsInfo.mockResolvedValue(mockInfo());
    const spec = await adapter.getInstrumentSpec('BTCUSDT');
    expect(spec?.qtyStep).toBe(0.001);
  });

  it('should return null if not found', async () => {
    mockGetInstrumentsInfo.mockResolvedValue({ retCode: 0, result: { list: [] } });
    expect(await adapter.getInstrumentSpec('X')).toBeNull();
  });

  it('should return null on exception', async () => {
    mockGetInstrumentsInfo.mockRejectedValue(new Error('err'));
    expect(await adapter.getInstrumentSpec('X')).toBeNull();
  });

  it('should cache spec', async () => {
    mockGetInstrumentsInfo.mockResolvedValue(mockInfo());
    await adapter.getInstrumentSpec('BTCUSDT');
    await adapter.getInstrumentSpec('BTCUSDT');
    expect(mockGetInstrumentsInfo).toHaveBeenCalledTimes(1);
  });
});

describe('submitOrder', () => {
  it('should return orderId', async () => {
    mockSubmitOrder.mockResolvedValue({ retCode: 0, result: { orderId: 'oid' } });
    expect(await adapter.submitOrder({ symbol: 'X', side: 'Buy', qty: 1 })).toEqual({ orderId: 'oid' });
  });

  it('should return null on API error', async () => {
    mockSubmitOrder.mockResolvedValue({ retCode: 1, retMsg: 'fail' });
    expect(await adapter.submitOrder({ symbol: 'X', side: 'Buy', qty: 1 })).toBeNull();
  });

  it('should return null on exception', async () => {
    mockSubmitOrder.mockRejectedValue(new Error('err'));
    expect(await adapter.submitOrder({ symbol: 'X', side: 'Buy', qty: 1 })).toBeNull();
  });
});

describe('setLeverage', () => {
  it('should return true on success', async () => {
    mockSetLeverage.mockResolvedValue({});
    expect(await adapter.setLeverage('X', 3)).toBe(true);
  });

  it('should return true on 110043', async () => {
    const err = new Error('not modified');
    (err as any).body = { retCode: 110043 };
    mockSetLeverage.mockRejectedValue(err);
    expect(await adapter.setLeverage('X', 3)).toBe(true);
  });

  it('should return false on other errors', async () => {
    mockSetLeverage.mockRejectedValue(new Error('err'));
    expect(await adapter.setLeverage('X', 3)).toBe(false);
  });
});

describe('getCloses', () => {
  it('should return parsed closes', async () => {
    mockGetKline.mockResolvedValue({ retCode: 0, result: { list: [['0', '0', '0', '0', '100', '0'], ['0', '0', '0', '0', '200', '0']] } });
    expect(await adapter.getCloses('X', 'D', 2)).toEqual([200, 100]);
  });

  it('should return empty on fail', async () => {
    mockGetKline.mockResolvedValue({ retCode: 1, retMsg: 'err' });
    expect(await adapter.getCloses('X', 'D', 2)).toEqual([]);
  });

  it('should return empty on exception', async () => {
    mockGetKline.mockRejectedValue(new Error('err'));
    expect(await adapter.getCloses('X', 'D', 2)).toEqual([]);
  });
});

describe('getActiveStockSymbols', () => {
  const resp = (list: any[], cursor?: string) => ({ retCode: 0, result: { list, nextPageCursor: cursor } });

  it('should filter stock symbols', async () => {
    mockGetInstrumentsInfo.mockResolvedValue(resp([
      { symbol: 'AAPLUSDT', symbolType: 'stock', lotSizeFilter: {}, priceFilter: {} },
      { symbol: 'BTC', symbolType: 'coin', lotSizeFilter: {}, priceFilter: {} },
    ]));
    expect(await adapter.getActiveStockSymbols()).toEqual(['AAPLUSDT']);
  });

  it('should paginate', async () => {
    mockGetInstrumentsInfo
      .mockResolvedValueOnce(resp([{ symbol: 'A', symbolType: 'stock', lotSizeFilter: {}, priceFilter: {} }], 'c1'))
      .mockResolvedValueOnce(resp([{ symbol: 'B', symbolType: 'stock', lotSizeFilter: {}, priceFilter: {} }]));
    expect(await adapter.getActiveStockSymbols()).toEqual(['A', 'B']);
  });

  it('should return empty on API error', async () => {
    mockGetInstrumentsInfo.mockResolvedValue({ retCode: 1, retMsg: 'err' });
    expect(await adapter.getActiveStockSymbols()).toEqual([]);
  });

  it('should return empty on exception', async () => {
    mockGetInstrumentsInfo.mockRejectedValue(new Error('err'));
    expect(await adapter.getActiveStockSymbols()).toEqual([]);
  });
});
