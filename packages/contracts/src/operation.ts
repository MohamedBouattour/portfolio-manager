export interface OperationRecord {
  id?: number;
  symbol: string;
  side: 'Buy' | 'Sell';
  action: 'ENTRY' | 'DCA_REBUY' | 'TAKE_PROFIT' | 'MANUAL' | 'CLOSE';
  qty: number;
  price: number;
  avgPriceBefore?: number;
  avgPriceAfter?: number;
  pnlPctBefore?: number;
  pnlPctAfter?: number;
  marginUsed?: number;
  leverage?: number;
  orderId?: string;
  source: 'bot' | 'manual' | 'cron';
  createdAt?: string;
}
