export interface Position {
  symbol: string;
  side: 'Buy' | 'Sell';
  size: number;
  avgPrice: number;
  markPrice: number;
  unrealisedPnl: number;
  positionValue: number;
  leverage: number;
  lastExecutionPrice?: number;
  lastExecutionSide?: 'Buy' | 'Sell';
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
