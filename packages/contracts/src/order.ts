export interface OrderParams {
  symbol: string;
  side: 'Buy' | 'Sell';
  qty: number;
  reduceOnly?: boolean;
}

export interface OrderResult {
  orderId: string;
}
