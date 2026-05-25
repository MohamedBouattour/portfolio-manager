import { Injectable } from '@nestjs/common';
import { BybitAdapter, roundQty } from 'bybit-stock-bot';
import { RestClientV5 } from 'bybit-api';

@Injectable()
export class BybitService {
  private adapter: BybitAdapter;
  private client: RestClientV5;

  constructor() {
    const apiKey = process.env.API_KEY || '';
    const secretKey = process.env.SECRET_KEY || '';
    const maskedKey = apiKey ? apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4) : 'none';
    console.log(`[BybitService] Constructor called. API_KEY: ${maskedKey}`);
    this.adapter = new BybitAdapter(apiKey, secretKey);
    this.client = new RestClientV5({
      key: apiKey,
      secret: secretKey,
      testnet: false,
      recv_window: 10_000,
      enable_time_sync: true,
    });
  }

  async getOpenPositions() {
    console.log('[BybitService] Fetching open positions...');
    try {
      const positions = await this.adapter.getOpenPositions();
      console.log(`[BybitService] Fetched positions count: ${positions.length}`);
      if (positions.length > 0) {
        console.log('[BybitService] Positions details:', JSON.stringify(positions));
      }
      return positions;
    } catch (err: any) {
      console.error('[BybitService] Error during fetching positions:', err);
      throw err;
    }
  }

  async getActiveStockSymbols() {
    return await this.adapter.getActiveStockSymbols();
  }

  async executeOrder(params: {
    symbol: string;
    side: 'Buy' | 'Sell';
    qty: number;
    reduceOnly?: boolean;
    leverage?: number;
  }) {
    const { symbol, side, qty, reduceOnly, leverage } = params;
    if (leverage && !reduceOnly) {
      await this.adapter.setLeverage(symbol, leverage);
    }
    const spec = await this.adapter.getInstrumentSpec(symbol);
    const rounded = spec ? roundQty(qty, spec) : qty;

    if (rounded <= 0) {
      throw new Error(`Quantity rounded to 0 based on instrument minQty/qtyStep rules`);
    }

    return await this.adapter.submitOrder({
      symbol,
      side,
      qty: rounded,
      reduceOnly: !!reduceOnly,
    });
  }

  async getKlines(params: {
    symbol: string;
    interval: any;
    limit: number;
  }) {
    return await this.client.getKline({
      category: 'linear',
      symbol: params.symbol,
      interval: params.interval,
      limit: params.limit,
    });
  }
}
