import { RestClientV5 } from 'bybit-api';
import { Exchange, Position, InstrumentSpec, OrderParams, OrderResult } from '../types/index.js';
import { log } from '../utils/logger.js';

export class BybitAdapter implements Exchange {
  private client: RestClientV5;
  private specCache = new Map<string, InstrumentSpec>();

  constructor(apiKey: string, secretKey: string) {
    this.client = new RestClientV5({
      key: apiKey,
      secret: secretKey,
      testnet: false,
      recv_window: 10_000,
    });
  }

  public async getOpenPositions(): Promise<Position[]> {
    try {
      const res = await this.client.getPositionInfo({
        category: 'linear',
        settleCoin: 'USDT',
      });

      if (res.retCode !== 0) {
        log.error('getPositionInfo failed on Bybit', res.retMsg);
        return [];
      }

      const list = res.result?.list ?? [];

      return list
        .filter((p: any) => parseFloat(p.size) > 0)
        .map((p: any) => ({
          symbol: p.symbol as string,
          side: p.side as 'Buy' | 'Sell',
          size: parseFloat(p.size),
          avgPrice: parseFloat(p.avgPrice),
          markPrice: parseFloat(p.markPrice),
          unrealisedPnl: parseFloat(p.unrealisedPnl),
          positionValue: parseFloat(p.positionValue),
          leverage: parseFloat(p.leverage),
        }));
    } catch (err) {
      log.error('Failed to get positions from Bybit', err);
      return [];
    }
  }

  public async getInstrumentSpec(symbol: string): Promise<InstrumentSpec | null> {
    if (this.specCache.has(symbol)) {
      return this.specCache.get(symbol)!;
    }

    try {
      const res = await this.client.getInstrumentsInfo({
        category: 'linear',
        symbol,
      });

      const info = res.result?.list?.[0];
      if (!info) {
        log.warn(`Instrument not found on Bybit: ${symbol}`);
        return null;
      }

      const lot = info.lotSizeFilter;
      const price = info.priceFilter;

      const spec: InstrumentSpec = {
        symbol,
        minQty: parseFloat(lot?.minOrderQty ?? '0'),
        maxQty: parseFloat(lot?.maxOrderQty ?? '999999'),
        qtyStep: parseFloat(lot?.qtyStep ?? '0.01'),
        tickSize: parseFloat(price?.tickSize ?? '0.01'),
        minPrice: parseFloat(price?.minPrice ?? '0'),
        maxPrice: parseFloat(price?.maxPrice ?? '999999999'),
        minNotional: parseFloat((info as any).lotSizeFilter?.minNotionalValue ?? '0'),
      };

      this.specCache.set(symbol, spec);
      return spec;
    } catch (err) {
      log.error(`Failed to fetch Bybit spec for ${symbol}`, err);
      return null;
    }
  }

  public async submitOrder(params: OrderParams): Promise<OrderResult | null> {
    try {
      const res = await this.client.submitOrder({
        category: 'linear',
        symbol: params.symbol,
        side: params.side,
        orderType: 'Market',
        qty: params.qty.toString(),
        reduceOnly: params.reduceOnly ?? false,
        positionIdx: 0,
      });

      if (res.retCode !== 0) {
        log.error(`Order submission failed on Bybit for ${params.symbol}`, res.retMsg);
        return null;
      }

      return {
        orderId: res.result?.orderId ?? '',
      };
    } catch (err) {
      log.error(`Order submission exception on Bybit for ${params.symbol}`, err);
      return null;
    }
  }

  public async setLeverage(symbol: string, leverage: number): Promise<boolean> {
    try {
      await this.client.setLeverage({
        category: 'linear',
        symbol,
        buyLeverage: leverage.toString(),
        sellLeverage: leverage.toString(),
      });
      return true;
    } catch (err: any) {
      // 110043 means leverage not modified (already set to the requested value)
      if (err?.body?.retCode === 110043 || String(err).includes('110043')) {
        return true;
      }
      log.error(`Failed to set leverage on Bybit for ${symbol}`, err);
      return false;
    }
  }

  public async getCloses(symbol: string, interval: string, limit: number): Promise<number[]> {
    try {
      const res = await this.client.getKline({
        category: 'linear',
        symbol,
        interval: interval as any,
        limit,
      });

      if (res.retCode !== 0 || !res.result?.list?.length) {
        log.warn(`No kline data from Bybit for ${symbol}: ${res.retMsg}`);
        return [];
      }

      // Reverse so it is chronological (oldest to newest)
      return res.result.list
        .map((c: any) => parseFloat(c[4]))
        .reverse();
    } catch (err) {
      log.error(`Failed to fetch closes from Bybit for ${symbol}`, err);
      return [];
    }
  }

  public async getActiveStockSymbols(): Promise<string[]> {
    try {
      log.info('Fetching active stock symbols from Bybit...');
      const stocks: string[] = [];
      let cursor: string | undefined = undefined;
      let hasNext = true;

      while (hasNext) {
        const res: any = await this.client.getInstrumentsInfo({
          category: 'linear',
          limit: 1000,
          cursor,
        });

        if (res.retCode !== 0) {
          log.error('Failed to fetch instruments from Bybit', res.retMsg);
          break;
        }

        const list = res.result?.list ?? [];
        for (const info of list) {
          if (info.symbolType === 'stock') {
            stocks.push(info.symbol);

            // Populating cache automatically while we have the specs!
            const lot = info.lotSizeFilter;
            const price = info.priceFilter;
            const spec: InstrumentSpec = {
              symbol: info.symbol,
              minQty: parseFloat(lot?.minOrderQty ?? '0'),
              maxQty: parseFloat(lot?.maxOrderQty ?? '999999'),
              qtyStep: parseFloat(lot?.qtyStep ?? '0.01'),
              tickSize: parseFloat(price?.tickSize ?? '0.01'),
              minPrice: parseFloat(price?.minPrice ?? '0'),
              maxPrice: parseFloat(price?.maxPrice ?? '999999999'),
              minNotional: parseFloat(lot?.minNotionalValue ?? '0'),
            };
            this.specCache.set(info.symbol, spec);
          }
        }

        cursor = res.result?.nextPageCursor;
        if (!cursor || list.length === 0) {
          hasNext = false;
        }
      }

      log.info(`Discovered ${stocks.length} active TradFi stock symbols.`);
      return stocks;
    } catch (err) {
      log.error('Exception during getActiveStockSymbols', err);
      return [];
    }
  }
}
