import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Position, InstrumentSpec, OrderParams, OrderResult } from '@portfolio/contracts';

const CONNECTOR_URL = process.env.BYBIT_CONNECTOR_URL || 'http://localhost:3001';

@Injectable()
export class ConnectorExchangeService {
  async getOpenPositions(): Promise<Position[]> {
    const res = await axios.get(`${CONNECTOR_URL}/api/positions`);
    return res.data;
  }

  async getInstrumentSpec(symbol: string): Promise<InstrumentSpec | null> {
    try {
      const res = await axios.get(`${CONNECTOR_URL}/api/instrument`, {
        params: { symbol }
      });
      return res.data;
    } catch (_err) {
      return null;
    }
  }

  async submitOrder(params: OrderParams): Promise<OrderResult | null> {
    const res = await axios.post(`${CONNECTOR_URL}/api/order`, params);
    return res.data;
  }

  async setLeverage(symbol: string, leverage: number): Promise<boolean> {
    const res = await axios.post(`${CONNECTOR_URL}/api/leverage`, { symbol, leverage });
    return res.data.success;
  }

  async getActiveStockSymbols(): Promise<string[]> {
    const res = await axios.get(`${CONNECTOR_URL}/api/symbols?type=stock`);
    return res.data;
  }

  async getCloses(symbol: string, interval: string, limit: number): Promise<number[]> {
    const res = await axios.get(`${CONNECTOR_URL}/api/klines`, {
      params: { symbol, interval, limit }
    });
    const klines = res.data;
    if (!Array.isArray(klines) || klines.length === 0) {
      return [];
    }
    return klines.map((k: any) => k.close);
  }
}
