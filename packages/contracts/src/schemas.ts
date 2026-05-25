import { z } from 'zod';

export const PositionSchema = z.object({
  symbol: z.string(),
  side: z.enum(['Buy', 'Sell']),
  size: z.number(),
  avgPrice: z.number(),
  markPrice: z.number(),
  unrealisedPnl: z.number(),
  positionValue: z.number(),
  leverage: z.number(),
  lastExecutionPrice: z.number().optional(),
  lastExecutionSide: z.enum(['Buy', 'Sell']).optional(),
});

export const InstrumentSpecSchema = z.object({
  symbol: z.string(),
  minQty: z.number(),
  maxQty: z.number(),
  qtyStep: z.number(),
  tickSize: z.number(),
  minPrice: z.number(),
  maxPrice: z.number(),
  minNotional: z.number(),
});

export const OrderParamsSchema = z.object({
  symbol: z.string(),
  side: z.enum(['Buy', 'Sell']),
  qty: z.number(),
  reduceOnly: z.boolean().optional(),
});

export const OrderResultSchema = z.object({
  orderId: z.string(),
});

export const KlineSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

export const StrategySignalSchema = z.object({
  shouldEnter: z.boolean(),
  latestValues: z.object({
    macd: z.number(),
    signal: z.number(),
    histogram: z.number(),
  }),
  macdValue: z.number(),
  signalValue: z.number(),
  histValue: z.number(),
});

export const PositionDecisionSchema = z.object({
  action: z.enum(['HOLD', 'REDUCE', 'DCA_REBUY']),
  qty: z.number(),
  reason: z.string(),
});

export const EvaluationResultSchema = z.object({
  stepIndex: z.number(),
  evalPrice: z.number(),
  strategySignal: StrategySignalSchema,
  positionDecision: PositionDecisionSchema,
});

export const BotConfigSchema = z.object({
  interval: z.string(),
  balance: z.number(),
  leverage: z.number(),
  feePct: z.number(),
  profitThresholdPct: z.number(),
  rebuyThresholdPct: z.number(),
  reducePct: z.number(),
  rebuyQtyPct: z.number(),
  maxAllocPct: z.number(),
  stockSymbols: z.array(z.string()),
  dryRun: z.boolean().optional(),
  manualMode: z.boolean().optional(),
});
