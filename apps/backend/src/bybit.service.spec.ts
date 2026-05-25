import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockAdapterInstance, mockClientInstance } = vi.hoisted(() => ({
  mockAdapterInstance: {
    getOpenPositions: vi.fn(),
    getActiveStockSymbols: vi.fn(),
    submitOrder: vi.fn(),
    setLeverage: vi.fn(),
  },
  mockClientInstance: {
    getKline: vi.fn(),
  },
}));

vi.mock('bybit-stock-bot', () => ({
  BybitAdapter: function () { return mockAdapterInstance; },
}));

vi.mock('bybit-api', () => ({
  RestClientV5: function () { return mockClientInstance; },
}));

import { BybitService } from './bybit.service.js';

let service: BybitService;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_KEY = 'test-key';
  process.env.SECRET_KEY = 'test-secret';
  service = new BybitService();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getOpenPositions', () => {
  it('should return positions from adapter', async () => {
    mockAdapterInstance.getOpenPositions.mockResolvedValue([{ symbol: 'BTCUSDT' }]);
    expect(await service.getOpenPositions()).toEqual([{ symbol: 'BTCUSDT' }]);
  });

  it('should rethrow errors', async () => {
    mockAdapterInstance.getOpenPositions.mockRejectedValue(new Error('API error'));
    await expect(service.getOpenPositions()).rejects.toThrow('API error');
  });
});

describe('getActiveStockSymbols', () => {
  it('should return symbols', async () => {
    mockAdapterInstance.getActiveStockSymbols.mockResolvedValue(['AAPL']);
    expect(await service.getActiveStockSymbols()).toEqual(['AAPL']);
  });
});

describe('executeOrder', () => {
  it('should set leverage then submit', async () => {
    mockAdapterInstance.submitOrder.mockResolvedValue({ orderId: 'ord' });
    const r = await service.executeOrder({ symbol: 'X', side: 'Buy', qty: 1, leverage: 3 });
    expect(mockAdapterInstance.setLeverage).toHaveBeenCalledWith('X', 3);
    expect(r).toEqual({ orderId: 'ord' });
  });

  it('should skip leverage on reduceOnly', async () => {
    mockAdapterInstance.submitOrder.mockResolvedValue({ orderId: 'ord' });
    await service.executeOrder({ symbol: 'X', side: 'Sell', qty: 0.5, reduceOnly: true, leverage: 3 });
    expect(mockAdapterInstance.setLeverage).not.toHaveBeenCalled();
  });

  it('should skip leverage when not provided', async () => {
    mockAdapterInstance.submitOrder.mockResolvedValue({ orderId: 'ord' });
    await service.executeOrder({ symbol: 'X', side: 'Buy', qty: 1 });
    expect(mockAdapterInstance.setLeverage).not.toHaveBeenCalled();
  });
});

describe('getKlines', () => {
  it('should return klines', async () => {
    mockClientInstance.getKline.mockResolvedValue({ retCode: 0, result: { list: [] } });
    const r = await service.getKlines({ symbol: 'X', interval: 'D', limit: 100 });
    expect(mockClientInstance.getKline).toHaveBeenCalledWith({ category: 'linear', symbol: 'X', interval: 'D', limit: 100 });
    expect(r).toEqual({ retCode: 0, result: { list: [] } });
  });
});
