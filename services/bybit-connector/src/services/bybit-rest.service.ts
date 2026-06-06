import { Injectable } from '@nestjs/common';
import { RestClientV5 } from 'bybit-api';
import { Position, InstrumentSpec, OrderParams, OrderResult, Kline } from '@portfolio/contracts';

@Injectable()
export class BybitRestService {
  private client: RestClientV5;
  private specCache = new Map<string, InstrumentSpec>();

  constructor() {
    const apiKey = process.env.API_KEY || '';
    const secretKey = process.env.SECRET_KEY || '';
    const maskedKey = apiKey ? apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4) : 'none';
    console.log(`[BybitRestService] Initializing with API_KEY: ${maskedKey}`);

    this.client = new RestClientV5({
      key: apiKey,
      secret: secretKey,
      testnet: false,
      recv_window: 10_000,
      enable_time_sync: true,
    });
  }

  public async getWalletBalance(): Promise<any> {
    console.log('[BybitRestService] Fetching wallet balance...');
    try {
      const res = await this.client.getWalletBalance({
        accountType: 'UNIFIED',
        coin: 'USDT',
      });

      if (res.retCode !== 0) {
        console.error('[BybitRestService] getWalletBalance failed:', res.retMsg);
        return null;
      }

      return res.result?.list?.[0] ?? null;
    } catch (err) {
      console.error('[BybitRestService] Exception in getWalletBalance:', err);
      return null;
    }
  }

  public async getOpenPositions(): Promise<Position[]> {
    console.log('[BybitRestService] Fetching open positions...');
    try {
      const res = await this.client.getPositionInfo({
        category: 'linear',
        settleCoin: 'USDT',
      });

      if (res.retCode !== 0) {
        console.error('[BybitRestService] getPositionInfo failed:', res.retMsg);
        return [];
      }

      const list = res.result?.list ?? [];
      const activePositions: Position[] = list
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

      await Promise.all(
        activePositions.map(async (pos) => {
          try {
            const execRes = await this.client.getExecutionList({
              category: 'linear',
              symbol: pos.symbol,
              limit: 1,
            });
            const lastExec = execRes.result?.list?.[0];
            if (lastExec) {
              pos.lastExecutionPrice = parseFloat(lastExec.execPrice);
              pos.lastExecutionSide = lastExec.side as 'Buy' | 'Sell';
            }
          } catch (e) {
            console.error(`[BybitRestService] Failed to fetch last execution for ${pos.symbol}:`, e);
          }
        })
      );

      return activePositions;
    } catch (err) {
      console.error('[BybitRestService] Exception in getOpenPositions:', err);
      return [];
    }
  }

  public async getExecutions(symbol: string, limit = 50): Promise<any[]> {
    try {
      const res = await this.client.getExecutionList({
        category: 'linear',
        symbol,
        limit,
      });
      if (res.retCode !== 0) {
        console.error(`[BybitRestService] getExecutionList failed for ${symbol}:`, res.retMsg);
        return [];
      }
      return res.result?.list ?? [];
    } catch (err) {
      console.error(`[BybitRestService] getExecutionList exception for ${symbol}:`, err);
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
        console.warn(`[BybitRestService] Instrument not found: ${symbol}`);
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
      console.error(`[BybitRestService] Failed to fetch spec for ${symbol}:`, err);
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
        console.error(`[BybitRestService] Order failed for ${params.symbol}:`, res.retMsg);
        return null;
      }

      return {
        orderId: res.result?.orderId ?? '',
      };
    } catch (err) {
      console.error(`[BybitRestService] Order exception for ${params.symbol}:`, err);
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
      if (err?.body?.retCode === 110043 || String(err).includes('110043')) {
        return true;
      }
      console.error(`[BybitRestService] Failed to set leverage for ${symbol}:`, err);
      return false;
    }
  }

  public async getKlines(symbol: string, interval: string, limit: number): Promise<Kline[]> {
    try {
      const res = await this.client.getKline({
        category: 'linear',
        symbol,
        interval: interval as any,
        limit,
      });

      if (res.retCode !== 0 || !res.result?.list?.length) {
        return [];
      }

      return res.result.list.map((k: any) => ({
        time: parseInt(k[0]),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      })).reverse();
    } catch (err) {
      console.error(`[BybitRestService] Failed to fetch klines for ${symbol}:`, err);
      throw err;
    }
  }

  public async getActiveStockSymbols(): Promise<string[]> {
    try {
      console.log('[BybitRestService] Fetching active stock symbols from Bybit...');
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
          console.error('[BybitRestService] Failed to fetch instruments:', res.retMsg);
          break;
        }

        const list = res.result?.list ?? [];
        for (const info of list) {
          if (info.symbolType === 'stock') {
            stocks.push(info.symbol);

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

      console.log(`[BybitRestService] Discovered ${stocks.length} active TradFi stock symbols.`);
      return stocks;
    } catch (err) {
      console.error('[BybitRestService] Exception during getActiveStockSymbols:', err);
      return [];
    }
  }
}
