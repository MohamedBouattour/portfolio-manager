export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StrategySignal {
  shouldEnter: boolean;
  latestValues: {
    macd: number;
    signal: number;
    histogram: number;
  };
  macdValue: number;
  signalValue: number;
  histValue: number;
}

export interface PositionDecision {
  action: 'HOLD' | 'REDUCE' | 'DCA_REBUY';
  qty: number;
  reason: string;
}

export interface EvaluationResult {
  stepIndex: number;
  evalPrice: number;
  strategySignal: StrategySignal;
  positionDecision: PositionDecision;
}
