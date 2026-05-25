import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpException } from '@nestjs/common';

const { mockFs } = vi.hoisted(() => ({
  mockFs: {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

const { mockBybitService } = vi.hoisted(() => ({
  mockBybitService: {
    getOpenPositions: vi.fn(),
    getActiveStockSymbols: vi.fn(),
    executeOrder: vi.fn(),
    getKlines: vi.fn(),
  },
}));

vi.mock('fs', () => mockFs);
vi.mock('./bybit.service.js', () => ({
  BybitService: vi.fn(() => mockBybitService),
}));

vi.mock('bybit-stock-bot', () => ({
  MACDStrategy: function () {
    return {
      evaluate: vi.fn(() => ({
        shouldEnter: false,
        latestValues: { macd: 0, signal: 0, histogram: 0 },
      })),
    };
  },
  MIN_MACD_CANDLES: 10,
}));

import { AppController } from './app.controller.js';

let controller: AppController;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_KEY = 'test-key';
  process.env.SECRET_KEY = 'test-secret';
  process.env.TIME_FRAME = '240';

  mockFs.existsSync.mockReturnValue(true);

  controller = new AppController(mockBybitService as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getConfig', () => {
  it('should return config with timeframe and manualMode', () => {
    const result = controller.getConfig();
    expect(result).toHaveProperty('timeframe');
    expect(result).toHaveProperty('manualMode');
    expect(result.manualMode).toBe(false);
  });
});

describe('getStocks', () => {
  it('should return stock symbols from service', async () => {
    mockBybitService.getActiveStockSymbols.mockResolvedValue(['AAPLUSDT', 'TSLAUSDT']);
    const result = await controller.getStocks();
    expect(result).toEqual(['AAPLUSDT', 'TSLAUSDT']);
  });

  it('should cache results within 600s', async () => {
    mockBybitService.getActiveStockSymbols.mockResolvedValue(['AAPLUSDT']);
    await controller.getStocks();
    const callCount = mockBybitService.getActiveStockSymbols.mock.calls.length;
    await controller.getStocks();
    expect(mockBybitService.getActiveStockSymbols.mock.calls.length).toBe(callCount);
  });

  it('should return fallback when service returns empty', async () => {
    mockBybitService.getActiveStockSymbols.mockResolvedValue([]);
    const result = await controller.getStocks();
    expect(result).toContain('AAPLUSDT');
  });

  it('should return fallback on error', async () => {
    mockBybitService.getActiveStockSymbols.mockRejectedValue(new Error('fail'));
    const result = await controller.getStocks();
    expect(result).toContain('AAPLUSDT');
  });
});

describe('getKlines', () => {
  it('should return formatted kline data', async () => {
    mockBybitService.getKlines.mockResolvedValue({
      retCode: 0,
      result: {
        list: [
          ['1700000000000', '100', '110', '90', '105', '1000', '100000'],
          ['1700086400000', '105', '115', '95', '110', '2000', '200000'],
        ],
      },
    });

    const result = await controller.getKlines('BTCUSDT', 'D');
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('time');
    expect(result[0]).toHaveProperty('open');
    expect(result[0]).toHaveProperty('high');
    expect(result[0]).toHaveProperty('low');
    expect(result[0]).toHaveProperty('close');
    expect(result[0]).toHaveProperty('volume');
    expect(result[0].close).toBe(110);
    expect(result[1].close).toBe(105);
  });

  it('should throw 400 when symbol missing', async () => {
    await expect(controller.getKlines('', 'D')).rejects.toThrow(HttpException);
  });

  it('should throw 500 on API error', async () => {
    mockBybitService.getKlines.mockResolvedValue({ retCode: 10001, retMsg: 'API Error' });
    await expect(controller.getKlines('BTCUSDT', 'D')).rejects.toThrow(HttpException);
  });

  it('should throw 500 on empty list', async () => {
    mockBybitService.getKlines.mockResolvedValue({ retCode: 0, result: { list: [] } });
    await expect(controller.getKlines('BTCUSDT', 'D')).rejects.toThrow(HttpException);
  });

  it('should throw 500 on exception', async () => {
    mockBybitService.getKlines.mockRejectedValue(new Error('fail'));
    await expect(controller.getKlines('BTCUSDT', 'D')).rejects.toThrow(HttpException);
  });
});

describe('evaluate', () => {
  const mockCloses = Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i * 0.1) * 10);

  it('should return expected shape', async () => {
    const result = await controller.evaluate({ closes: mockCloses, index: mockCloses.length - 1 });
    expect(result).toHaveProperty('stepIndex');
    expect(result).toHaveProperty('evalPrice');
    expect(result).toHaveProperty('strategySignal');
    expect(result).toHaveProperty('positionDecision');
    expect(result.positionDecision.action).toBe('HOLD');
  });

  it('should reject empty closes', async () => {
    await expect(controller.evaluate({ closes: [], index: 0 })).rejects.toThrow(HttpException);
  });

  it('should reject out-of-bounds index', async () => {
    await expect(controller.evaluate({ closes: mockCloses, index: -1 })).rejects.toThrow(HttpException);
    await expect(controller.evaluate({ closes: mockCloses, index: 999 })).rejects.toThrow(HttpException);
  });

  it('should detect REDUCE on profit', async () => {
    const result = await controller.evaluate({
      closes: [100, 100, 100, 115, 115], index: 4,
      position: { side: 'Buy', size: 10, avgPrice: 100, markPrice: 115 },
      config: { leverage: 3, balance: 1000, profitThresholdPct: 10, rebuyThresholdPct: 15, reducePct: 15, maxAllocPct: 20 },
    });
    expect(result.positionDecision.action).toBe('REDUCE');
  });

  it('should detect DCA_REBUY on loss', async () => {
    const result = await controller.evaluate({
      closes: [100, 100, 100, 85, 85], index: 4,
      position: { side: 'Buy', size: 10, avgPrice: 100, markPrice: 85 },
      config: { leverage: 3, balance: 1000, profitThresholdPct: 15, rebuyThresholdPct: 10, reducePct: 15, maxAllocPct: 20 },
    });
    expect(result.positionDecision.action).toBe('DCA_REBUY');
  });

  it('should handle sell side', async () => {
    const result = await controller.evaluate({
      closes: [100, 100, 100, 85, 85], index: 4,
      position: { side: 'Sell', size: 10, avgPrice: 100, markPrice: 85 },
      config: { leverage: 3, balance: 1000, profitThresholdPct: 10, rebuyThresholdPct: 15, reducePct: 15, maxAllocPct: 20 },
    });
    expect(result.positionDecision.action).toBe('REDUCE');
  });
});

describe('getPositions', () => {
  it('should return positions', async () => {
    mockBybitService.getOpenPositions.mockResolvedValue([{ symbol: 'BTCUSDT' }]);
    expect(await controller.getPositions()).toEqual([{ symbol: 'BTCUSDT' }]);
  });

  it('should throw on error', async () => {
    mockBybitService.getOpenPositions.mockRejectedValue(new Error('fail'));
    await expect(controller.getPositions()).rejects.toThrow(HttpException);
  });
});

describe('executeOrder', () => {
  it('should execute via service', async () => {
    mockBybitService.executeOrder.mockResolvedValue({ orderId: 'ord-123' });
    const result = await controller.executeOrder({ symbol: 'BTCUSDT', side: 'Buy', qty: 1, leverage: 3 });
    expect(result).toEqual({ orderId: 'ord-123' });
    expect(mockBybitService.executeOrder).toHaveBeenCalledWith({ symbol: 'BTCUSDT', side: 'Buy', qty: 1, leverage: 3 });
  });

  it('should throw on missing params', async () => {
    await expect(controller.executeOrder({ symbol: '', side: 'Buy', qty: 0 } as any)).rejects.toThrow(HttpException);
  });

  it('should throw on null result', async () => {
    mockBybitService.executeOrder.mockResolvedValue(null);
    await expect(controller.executeOrder({ symbol: 'BTCUSDT', side: 'Buy', qty: 1 })).rejects.toThrow(HttpException);
  });

  it('should throw on error', async () => {
    mockBybitService.executeOrder.mockRejectedValue(new Error('fail'));
    await expect(controller.executeOrder({ symbol: 'BTCUSDT', side: 'Buy', qty: 1 })).rejects.toThrow(HttpException);
  });
});

describe('getMomentum', () => {
  beforeEach(() => {
    mockBybitService.getKlines.mockResolvedValue({
      retCode: 0,
      result: {
        list: [
          ['0', '100', '110', '90', '110', '100', '0'],
          ['1', '110', '120', '100', '109', '200', '0'],
        ],
      },
    });
    mockBybitService.getActiveStockSymbols.mockResolvedValue(['AAPLUSDT']);
  });

  it('should return momentum data', async () => {
    const result = await controller.getMomentum();
    expect(result.length).toBeGreaterThan(0);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty('changePct');
    }
  });

  it('should use cache within 120s', async () => {
    await controller.getMomentum();
    const calls = mockBybitService.getKlines.mock.calls.length;
    await controller.getMomentum();
    expect(mockBybitService.getKlines.mock.calls.length).toBe(calls);
  });

  it('should return fallback on error', async () => {
    mockBybitService.getActiveStockSymbols.mockRejectedValue(new Error('fail'));
    const result = await controller.getMomentum();
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getScoutingStatus', () => {
  beforeEach(() => {
    mockBybitService.getKlines.mockResolvedValue({
      retCode: 0,
      result: {
        list: [
          ['1700000000000', '100', '110', '90', '105', '1000', '0'],
          ['1700086400000', '105', '115', '95', '110', '2000', '0'],
          ['1700172800000', '110', '120', '100', '115', '1500', '0'],
          ['1700259200000', '115', '125', '105', '120', '1800', '0'],
          ['1700345600000', '120', '130', '110', '125', '2000', '0'],
          ['1700432000000', '125', '135', '115', '130', '2200', '0'],
          ['1700518400000', '130', '140', '120', '135', '2500', '0'],
          ['1700604800000', '135', '145', '125', '140', '2500', '0'],
          ['1700691200000', '140', '150', '130', '145', '2500', '0'],
          ['1700777600000', '145', '155', '135', '150', '2500', '0'],
          ['1700864000000', '150', '160', '140', '155', '2500', '0'],
          ['1700950400000', '155', '165', '145', '160', '2500', '0'],
        ],
      },
    });
    mockBybitService.getActiveStockSymbols.mockResolvedValue(['AAPLUSDT', 'TSLAUSDT']);
  });

  it('should return scouting results', async () => {
    const result = await controller.getScoutingStatus();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should use cache within 60s TTL', async () => {
    await controller.getScoutingStatus();
    const calls = mockBybitService.getKlines.mock.calls.length;
    await controller.getScoutingStatus();
    expect(mockBybitService.getKlines.mock.calls.length).toBe(calls);
  });

  it('should handle kline errors gracefully', async () => {
    mockBybitService.getKlines.mockRejectedValue(new Error('API error'));
    const result = await controller.getScoutingStatus();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle stock service failure gracefully', async () => {
    const ctrl = new AppController(mockBybitService as any);
    mockBybitService.getActiveStockSymbols.mockRejectedValue(new Error('Fatal'));
    const result = await ctrl.getScoutingStatus();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should write log file with scout results', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockImplementation(() => {});
    await controller.getScoutingStatus();
    expect(mockFs.writeFileSync).toHaveBeenCalled();
  });
});

describe('getLatestLog', () => {
  it('should return latest log', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue(['1.log', '2.log']);
    mockFs.readFileSync.mockReturnValue('content');
    const result = await controller.getLatestLog();
    expect(result).toHaveProperty('content');
    expect(result.content).toBe('content');
  });

  it('should handle missing logs dir', async () => {
    mockFs.existsSync.mockReturnValue(false);
    const result = await controller.getLatestLog();
    expect(result.content).toContain('No logs available');
  });

  it('should handle empty logs dir', async () => {
    mockFs.readdirSync.mockReturnValue([]);
    const result = await controller.getLatestLog();
    expect(result.content).toContain('No logs found');
  });
});
