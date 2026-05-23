import { Controller, Get, Post, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { BybitAdapter, MACDStrategy } from 'bybit-stock-bot';
import { RestClientV5 } from 'bybit-api';

@Controller('api')
export class AppController {
  private adapter: BybitAdapter;
  private client: RestClientV5;
  private momentumCache: any = null;
  private lastFetchTime = 0;

  constructor() {
    const apiKey = process.env.API_KEY || '';
    const secretKey = process.env.SECRET_KEY || '';
    this.adapter = new BybitAdapter(apiKey, secretKey);
    this.client = new RestClientV5({
      key: apiKey,
      secret: secretKey,
      testnet: false,
    });
  }

  @Get('stocks')
  async getStocks() {
    try {
      // Dynamic scanning of symbols
      const symbols = await this.adapter.getActiveStockSymbols();
      if (symbols && symbols.length > 0) {
        return symbols;
      }
      // Fallback in case of failure or empty
      return [
        'AAPLUSDT', 'TSLAUSDT', 'NVDAUSDT', 'AMZNUSDT', 'GOOGLUSDT',
        'MSFTUSDT', 'METAUSDT', 'COINUSDT', 'MSTRUSDT', 'AMDUSDT',
        'INTCUSDT', 'PLTRUSDT', 'QQQUSDT', 'SPYUSDT', 'TSMUSDT',
      ];
    } catch (err: any) {
      return [
        'AAPLUSDT', 'TSLAUSDT', 'NVDAUSDT', 'AMZNUSDT', 'GOOGLUSDT',
        'MSFTUSDT', 'METAUSDT', 'COINUSDT', 'MSTRUSDT', 'AMDUSDT',
        'INTCUSDT', 'PLTRUSDT', 'QQQUSDT', 'SPYUSDT', 'TSMUSDT',
      ];
    }
  }

  @Get('klines')
  async getKlines(@Query('symbol') symbol: string, @Query('interval') interval = 'D') {
    if (!symbol) {
      throw new HttpException('Symbol query param is required', HttpStatus.BAD_REQUEST);
    }
    try {
      const limit = 200;
      const res = await this.client.getKline({
        category: 'linear',
        symbol,
        interval: interval as any,
        limit,
      });

      if (res.retCode !== 0 || !res.result?.list?.length) {
        throw new HttpException(res.retMsg || 'Failed to fetch klines', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Map to standard format for front-end charts: time, open, high, low, close
      // Bybit kline list format: [startTime, openPrice, highPrice, lowPrice, closePrice, volume, turnover]
      // Sort chronologically (oldest to newest)
      const data = res.result.list
        .map((k: any) => ({
          time: parseInt(k[0]) / 1000, // Unix timestamp in seconds
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }))
        .reverse();

      return data;
    } catch (err: any) {
      throw new HttpException(err.message || 'Error fetching klines', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('evaluate')
  async evaluate(
    @Body()
    body: {
      closes: number[];
      index: number;
      position?: {
        side: 'Buy' | 'Sell';
        size: number;
        avgPrice: number;
        markPrice: number;
      };
      config?: {
        leverage: number;
        balance: number;
        profitThresholdPct: number;
        rebuyThresholdPct: number;
        reducePct: number;
        maxAllocPct: number;
      };
    }
  ) {
    const { closes, index, position, config } = body;
    if (!closes || closes.length === 0) {
      throw new HttpException('Closes array is required', HttpStatus.BAD_REQUEST);
    }
    if (index === undefined || index < 0 || index >= closes.length) {
      throw new HttpException('Invalid index parameter', HttpStatus.BAD_REQUEST);
    }

    try {
      // 1. Evaluate strategy at the specific index (up to index+1 closes)
      const historySlice = closes.slice(0, index + 1);
      const strategy = new MACDStrategy(12, 26, 9);
      const { shouldEnter, latestValues } = strategy.evaluate(historySlice);

      // 2. Evaluate position management rules at that step
      let positionDecision = {
        action: 'HOLD',
        qty: 0,
        reason: 'No action required or position not active.',
      };

      if (position) {
        const leverage = config?.leverage ?? 3;
        const balance = config?.balance ?? 1000;
        const profitThresholdPct = config?.profitThresholdPct ?? 15;
        const rebuyThresholdPct = config?.rebuyThresholdPct ?? 15;
        const reducePct = config?.reducePct ?? 15;
        const maxAllocPct = config?.maxAllocPct ?? 20;

        // Calculate current position PnL based on markPrice at the evaluation index
        const currentMarkPrice = closes[index];
        const rawPnl =
          position.side === 'Buy'
            ? (currentMarkPrice - position.avgPrice) * position.size
            : (position.avgPrice - currentMarkPrice) * position.size;

        const positionValue = position.size * position.avgPrice;
        const initialMargin = positionValue / leverage;
        const pnlPct = initialMargin > 0 ? (rawPnl / initialMargin) * 100 : 0;

        if (pnlPct >= profitThresholdPct) {
          const qtyToReduce = position.size * (reducePct / 100);
          positionDecision = {
            action: 'REDUCE',
            qty: parseFloat(qtyToReduce.toFixed(4)),
            reason: `Take Profit triggered. PnL is +${pnlPct.toFixed(2)}% >= +${profitThresholdPct}%. Reducing position size by ${reducePct}%.`,
          };
        } else if (pnlPct <= -rebuyThresholdPct) {
          const targetNotional = balance * (maxAllocPct / 100);
          const rawRebuyQty = targetNotional / currentMarkPrice;
          positionDecision = {
            action: 'DCA_REBUY',
            qty: parseFloat(rawRebuyQty.toFixed(4)),
            reason: `DCA Rebuy triggered. PnL is ${pnlPct.toFixed(2)}% <= -${rebuyThresholdPct}%. Adding position size.`,
          };
        } else {
          positionDecision = {
            action: 'HOLD',
            qty: 0,
            reason: `PnL is ${pnlPct.toFixed(2)}% (within [-${rebuyThresholdPct}%, +${profitThresholdPct}%]). Holding position.`,
          };
        }
      }

      return {
        stepIndex: index,
        evalPrice: closes[index],
        strategySignal: {
          shouldEnter,
          latestValues,
          macdValue: latestValues?.macd ?? 0,
          signalValue: latestValues?.signal ?? 0,
          histValue: latestValues?.histogram ?? 0,
        },
        positionDecision,
      };
    } catch (err: any) {
      throw new HttpException(err.message || 'Evaluation error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('momentum')
  async getMomentum() {
    const now = Date.now();
    if (this.momentumCache && now - this.lastFetchTime < 120000) {
      return this.momentumCache;
    }

    try {
      const symbols = await this.getStocks();
      const targetSymbols = symbols.slice(0, 15);
      
      const results = await Promise.all(
        targetSymbols.map(async (symbol) => {
          try {
            const limit = 7; // 7 daily klines = 7 days
            const res = await this.client.getKline({
              category: 'linear',
              symbol,
              interval: 'D',
              limit,
            });

            if (res.retCode === 0 && res.result?.list?.length > 1) {
              const list = res.result.list;
              const latestClose = parseFloat(list[0][4]);
              const oldestClose = parseFloat(list[list.length - 1][4]);
              const changePct = ((latestClose - oldestClose) / oldestClose) * 100;
              return {
                symbol,
                price: latestClose,
                changePct,
              };
            }
          } catch (e) {
            // Ignore error
          }
          return null;
        })
      );

      const momentumStocks = results
        .filter((r): r is { symbol: string; price: number; changePct: number } => r !== null && r.changePct > 0)
        .sort((a, b) => b.changePct - a.changePct);

      this.momentumCache = momentumStocks;
      this.lastFetchTime = now;
      return momentumStocks;
    } catch (err: any) {
      return [
        { symbol: 'AAPLUSDT', price: 292.40, changePct: 5.4 },
        { symbol: 'TSLAUSDT', price: 182.10, changePct: 12.8 },
        { symbol: 'NVDAUSDT', price: 915.20, changePct: 8.2 },
        { symbol: 'AMZNUSDT', price: 185.50, changePct: 3.1 },
        { symbol: 'GOOGLUSDT', price: 173.80, changePct: 2.4 },
      ];
    }
  }
}
