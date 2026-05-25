import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradingEngine } from './TradingEngine.js';
import { Exchange, BotConfig, Position, InstrumentSpec, OrderParams } from '../types/index.js';
import { Strategy } from '../strategies/MACDStrategy.js';

// Helper to create a dummy InstrumentSpec
const createMockSpec = (symbol: string, minQty = 0.01, tickSize = 0.01, minNotional = 5): InstrumentSpec => ({
  symbol,
  minQty,
  maxQty: 999999,
  qtyStep: minQty,
  tickSize,
  minPrice: 0.01,
  maxPrice: 999999,
  minNotional,
});

describe('TradingEngine Unit Tests', () => {
  let mockExchange: Exchange;
  let mockConfig: BotConfig;
  let mockStrategy: Strategy;

  // Trackers for mock calls
  let submittedOrders: OrderParams[];
  let setLeverageCalls: { symbol: string; leverage: number }[];
  let mockPositions: Position[];
  let mockCloses: Record<string, number[]>;
  let mockSpecs: Record<string, InstrumentSpec>;

  beforeEach(() => {
    submittedOrders = [];
    setLeverageCalls = [];
    mockPositions = [];
    mockCloses = {};
    mockSpecs = {
      AAPLUSDT: createMockSpec('AAPLUSDT'),
      TSLAUSDT: createMockSpec('TSLAUSDT'),
      GOOGLUSDT: createMockSpec('GOOGLUSDT'),
    };

    mockExchange = {
      getOpenPositions: vi.fn(async () => mockPositions),
      getInstrumentSpec: vi.fn(async (symbol: string) => mockSpecs[symbol] ?? null),
      submitOrder: vi.fn(async (params: OrderParams) => {
        submittedOrders.push(params);
        return { orderId: 'mock-order-id' };
      }),
      setLeverage: vi.fn(async (symbol: string, leverage: number) => {
        setLeverageCalls.push({ symbol, leverage });
        return true;
      }),
      getCloses: vi.fn(async (symbol: string) => mockCloses[symbol] ?? Array(200).fill(100)),
      getActiveStockSymbols: vi.fn(async () => ['AAPLUSDT', 'TSLAUSDT', 'GOOGLUSDT']),
    };

    mockConfig = {
      apiKey: 'test-key',
      secretKey: 'test-secret',
      interval: 'D',
      balance: 1000,
      leverage: 3,
      feePct: 0.04,
      profitThresholdPct: 15,
      rebuyThresholdPct: 15,
      reducePct: 15,
      maxAllocPct: 20, // 20% alloc -> $200 notional slice
      stockSymbols: ['AAPLUSDT', 'TSLAUSDT'],
      dryRun: false,
    };

    mockStrategy = {
      name: 'Mock Strategy',
      evaluate: vi.fn(() => ({ shouldEnter: false, latestValues: { macd: 0, signal: 0, histogram: 0 } })),
    };
  });

  describe('Dynamic Symbols Discovery', () => {
    it('should resolve specific stockSymbols if set in config', async () => {
      mockConfig.stockSymbols = ['AAPLUSDT'];
      const engine = new TradingEngine(mockExchange, mockConfig, mockStrategy);

      await engine.run();

      expect(mockExchange.getInstrumentSpec).toHaveBeenCalledWith('AAPLUSDT');
      expect(mockExchange.getInstrumentSpec).not.toHaveBeenCalledWith('TSLAUSDT');
      expect(mockExchange.getActiveStockSymbols).not.toHaveBeenCalled();
    });

    it('should fetch active stock symbols dynamically when config is ALL', async () => {
      mockConfig.stockSymbols = ['ALL'];
      const engine = new TradingEngine(mockExchange, mockConfig, mockStrategy);

      await engine.run();

      expect(mockExchange.getActiveStockSymbols).toHaveBeenCalled();
      expect(mockExchange.getInstrumentSpec).toHaveBeenCalledWith('AAPLUSDT');
      expect(mockExchange.getInstrumentSpec).toHaveBeenCalledWith('TSLAUSDT');
      expect(mockExchange.getInstrumentSpec).toHaveBeenCalledWith('GOOGLUSDT');
    });
  });

  describe('Position Management', () => {
    it('should take no action if position PnL is within thresholds', async () => {
      // average price = 100, mark price = 103 -> return = 3%
      // 3x leverage -> initial margin = value / leverage = 100/3 = 33.33
      // PnL = (103 - 100) = +3. Return % = (3 / 33.33) * 100 = +9% (which is < 15%)
      mockPositions = [
        {
          symbol: 'AAPLUSDT',
          side: 'Buy',
          size: 1,
          avgPrice: 100,
          markPrice: 103,
          unrealisedPnl: 3,
          positionValue: 100,
          leverage: 3,
        },
      ];

      const engine = new TradingEngine(mockExchange, mockConfig, mockStrategy);
      await engine.run();

      expect(submittedOrders).toHaveLength(0);
    });

    it('should reduce position size (Take Profit) by 15% if PnL >= +15%', async () => {
      // markPrice = 106 -> profit = $6 -> return % = (6 / 33.33) * 100 = +18% (exceeds +15%)
      mockPositions = [
        {
          symbol: 'AAPLUSDT',
          side: 'Buy',
          size: 10,
          avgPrice: 100,
          markPrice: 106,
          unrealisedPnl: 60,
          positionValue: 1000,
          leverage: 3,
        },
      ];

      const engine = new TradingEngine(mockExchange, mockConfig, mockStrategy);
      await engine.run();

      // Reduce qty = 10 * 15% = 1.5 units
      expect(submittedOrders).toHaveLength(1);
      expect(submittedOrders[0]).toEqual({
        symbol: 'AAPLUSDT',
        side: 'Sell',
        qty: 1.5,
        reduceOnly: true,
      });
    });

    it('should round Take Profit quantity according to specs', async () => {
      mockSpecs['AAPLUSDT'] = createMockSpec('AAPLUSDT', 1.0); // lot step = 1.0

      mockPositions = [
        {
          symbol: 'AAPLUSDT',
          side: 'Buy',
          size: 10,
          avgPrice: 100,
          markPrice: 106,
          unrealisedPnl: 60,
          positionValue: 1000,
          leverage: 3,
        },
      ];

      const engine = new TradingEngine(mockExchange, mockConfig, mockStrategy);
      await engine.run();

      // 10 * 15% = 1.5 units. Rounded down to multiple of 1.0 -> 1 unit.
      expect(submittedOrders).toHaveLength(1);
      expect(submittedOrders[0].qty).toBe(1.0);
    });

    it('should skip Take Profit if rounded reduction quantity is 0', async () => {
      mockSpecs['AAPLUSDT'] = createMockSpec('AAPLUSDT', 1.0); // minOrderQty = 1.0

      mockPositions = [
        {
          symbol: 'AAPLUSDT',
          side: 'Buy',
          size: 1, // 15% of 1 is 0.15, rounded to lotStep of 1.0 is 0
          avgPrice: 100,
          markPrice: 106,
          unrealisedPnl: 6,
          positionValue: 100,
          leverage: 3,
        },
      ];

      const engine = new TradingEngine(mockExchange, mockConfig, mockStrategy);
      await engine.run();

      expect(submittedOrders).toHaveLength(0);
    });

    it('should execute DCA Rebuy when position PnL <= -15%', async () => {
      // markPrice = 94 -> loss = $6 -> return % = (-6 / 33.33) * 100 = -18% (exceeds -15%)
      mockPositions = [
        {
          symbol: 'AAPLUSDT',
          side: 'Buy',
          size: 10,
          avgPrice: 100,
          markPrice: 94,
          unrealisedPnl: -60,
          positionValue: 1000,
          leverage: 3,
        },
      ];

      const engine = new TradingEngine(mockExchange, mockConfig, mockStrategy);
      await engine.run();

      // Rebuy targetNotional = balance * maxAllocPct = 1000 * 20% = $200.
      // Rebuy qty = 200 / 94 = 2.1276. Rounded to 0.01 step -> 2.12.
      expect(submittedOrders).toHaveLength(1);
      expect(submittedOrders[0]).toEqual({
        symbol: 'AAPLUSDT',
        side: 'Buy',
        qty: 2.12,
        reduceOnly: false,
      });
    });

    it('should skip DCA Rebuy if required margin exceeds 95% of balance', async () => {
      mockPositions = [
        {
          symbol: 'AAPLUSDT',
          side: 'Buy',
          size: 10,
          avgPrice: 100,
          markPrice: 94,
          unrealisedPnl: -60,
          positionValue: 1000,
          leverage: 3,
        },
      ];

      // Increase allocation to exceed balance limits
      mockConfig.balance = 60;
      mockConfig.maxAllocPct = 300; // 300% of $60 = $180 target notional -> requires ~$60 margin, exceeding 95% of $60 ($57)

      const engine = new TradingEngine(mockExchange, mockConfig, mockStrategy);
      await engine.run();

      expect(submittedOrders).toHaveLength(0);
    });
  });

  describe('Entry Scouting', () => {
    it('should not open position if strategy does not trigger', async () => {
      const engine = new TradingEngine(mockExchange, mockConfig, mockStrategy);
      await engine.run();

      expect(submittedOrders).toHaveLength(0);
    });

    it('should open new position if strategy triggers bullish crossover', async () => {
      // Mock strategy returning entry signal
      vi.mocked(mockStrategy.evaluate).mockReturnValue({
        shouldEnter: true,
        latestValues: { macd: -0.5, signal: -0.6, histogram: 0.1 },
      });

      // Price of AAPLUSDT at last close = 150
      mockCloses['AAPLUSDT'] = Array(200).fill(150);
      mockCloses['TSLAUSDT'] = Array(200).fill(200);

      const engine = new TradingEngine(mockExchange, mockConfig, mockStrategy);
      await engine.run();

      // Should open position for BOTH AAPLUSDT and TSLAUSDT because they both triggered
      // Target Notional = balance * maxAllocPct * leverage = 1000 * 20% * 3 = $600.
      // For AAPL: qty = 600 / 150 = 4.0 units.
      // For TSLA: qty = 600 / 200 = 3.0 units.
      expect(submittedOrders).toHaveLength(2);
      expect(submittedOrders).toContainEqual({
        symbol: 'AAPLUSDT',
        side: 'Buy',
        qty: 4.0,
        reduceOnly: false,
      });
      expect(submittedOrders).toContainEqual({
        symbol: 'TSLAUSDT',
        side: 'Buy',
        qty: 3.0,
        reduceOnly: false,
      });

      // Should set leverage on the exchange first
      expect(setLeverageCalls).toContainEqual({ symbol: 'AAPLUSDT', leverage: 3 });
      expect(setLeverageCalls).toContainEqual({ symbol: 'TSLAUSDT', leverage: 3 });
    });

    it('should skip entry scouting for symbols that already have open positions', async () => {
      vi.mocked(mockStrategy.evaluate).mockReturnValue({
        shouldEnter: true,
        latestValues: { macd: -0.5, signal: -0.6, histogram: 0.1 },
      });

      mockPositions = [
        {
          symbol: 'AAPLUSDT',
          side: 'Buy',
          size: 10,
          avgPrice: 100,
          markPrice: 100,
          unrealisedPnl: 0,
          positionValue: 1000,
          leverage: 3,
        },
      ];

      const engine = new TradingEngine(mockExchange, mockConfig, mockStrategy);
      await engine.run();

      // Should only submit order for TSLAUSDT, skipping AAPLUSDT
      expect(submittedOrders).toHaveLength(1);
      expect(submittedOrders[0].symbol).toBe('TSLAUSDT');
    });

    it('should skip entry if required margin exceeds 95% of balance', async () => {
      vi.mocked(mockStrategy.evaluate).mockReturnValue({
        shouldEnter: true,
      });

      mockCloses['AAPLUSDT'] = Array(200).fill(100);
      mockConfig.stockSymbols = ['AAPLUSDT'];

      // Balance = 100. Target notional = 100 * 20% * 3 = $60. Qty = 60/100 = 0.6.
      // Margin needed = (0.6 * 100) / 3 = $20. 95% of balance (100) = $95. This is ok.
      // Let's set leverage very low or adjust allocations to trigger the safety rule.
      // If we set maxAllocPct = 100 (100% of balance) -> Target notional = 100 * 100% * 3 = $300.
      // Qty = 300 / 100 = 3. Margin needed = (3 * 100) / 3 = $100.
      // 95% of balance = $95. So marginNeeded (100) > 95% of balance (95) -> Should skip!
      mockConfig.maxAllocPct = 100;

      const engine = new TradingEngine(mockExchange, mockConfig, mockStrategy);
      await engine.run();

      expect(submittedOrders).toHaveLength(0);
    });

    it('should skip entry if exchange leverage adjustment fails', async () => {
      vi.mocked(mockStrategy.evaluate).mockReturnValue({
        shouldEnter: true,
      });

      mockCloses['AAPLUSDT'] = Array(200).fill(100);
      mockConfig.stockSymbols = ['AAPLUSDT'];

      // Set leverage returns false (fails)
      mockExchange.setLeverage = vi.fn().mockResolvedValue(false);

      const engine = new TradingEngine(mockExchange, mockConfig, mockStrategy);
      await engine.run();

      expect(submittedOrders).toHaveLength(0);
    });
  });

  describe('Manual Mode Execution Guard', () => {
    it('should skip entry order submission when manualMode is enabled', async () => {
      vi.mocked(mockStrategy.evaluate).mockReturnValue({
        shouldEnter: true,
        latestValues: { macd: -0.5, signal: -0.6, histogram: 0.1 },
      });
      mockCloses['AAPLUSDT'] = Array(200).fill(150);
      mockConfig.stockSymbols = ['AAPLUSDT'];
      mockConfig.manualMode = true;

      const engine = new TradingEngine(mockExchange, mockConfig, mockStrategy);
      await engine.run();

      expect(submittedOrders).toHaveLength(0);
    });

    it('should skip position management order submission (Take Profit / DCA) when manualMode is enabled', async () => {
      mockPositions = [
        {
          symbol: 'AAPLUSDT',
          side: 'Buy',
          size: 10,
          avgPrice: 100,
          markPrice: 118,
          unrealisedPnl: 180,
          positionValue: 1000,
          leverage: 3,
        },
      ];
      mockConfig.manualMode = true;

      const engine = new TradingEngine(mockExchange, mockConfig, mockStrategy);
      await engine.run();

      expect(submittedOrders).toHaveLength(0);
    });
  });
});
