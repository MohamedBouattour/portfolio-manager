export interface Position {
  symbol: string;
  side: 'Buy' | 'Sell';
  size: number;
  avgPrice: number;
  markPrice: number;
  unrealisedPnl: number;
  positionValue: number;
  leverage: number;
}

export interface InstrumentSpec {
  symbol: string;
  minQty: number;
  maxQty: number;
  qtyStep: number;
  tickSize: number;
  minPrice: number;
  maxPrice: number;
  minNotional: number;
}

export interface OrderParams {
  symbol: string;
  side: 'Buy' | 'Sell';
  qty: number;
  reduceOnly?: boolean;
}

export interface OrderResult {
  orderId: string;
}

export interface Exchange {
  getOpenPositions(): Promise<Position[]>;
  getInstrumentSpec(symbol: string): Promise<InstrumentSpec | null>;
  submitOrder(params: OrderParams): Promise<OrderResult | null>;
  setLeverage(symbol: string, leverage: number): Promise<boolean>;
  getCloses(symbol: string, interval: string, limit: number): Promise<number[]>;
  getActiveStockSymbols(): Promise<string[]>;
}

export interface BotConfig {
  apiKey: string;
  secretKey: string;
  interval: string;
  balance: number;
  leverage: number;
  feePct: number;
  profitThresholdPct: number;
  rebuyThresholdPct: number;
  reducePct: number;
  maxAllocPct: number;
  stockSymbols: string[];
  dryRun?: boolean;
}
