import { Injectable } from '@nestjs/common';
import { MACDStrategy, MIN_MACD_CANDLES } from '../strategies/macd.strategy.js';

@Injectable()
export class StrategyEvaluatorService {
  private strategy = new MACDStrategy(12, 26, 9);

  evaluate(
    closes: number[],
    index: number,
    position?: {
      side: 'Buy' | 'Sell';
      size: number;
      avgPrice: number;
      markPrice: number;
      lastExecutionPrice?: number;
      lastExecutionSide?: 'Buy' | 'Sell';
    },
    config?: {
      leverage: number;
      balance: number;
      profitThresholdPct: number;
      rebuyThresholdPct: number;
      reducePct: number;
      rebuyQtyPct: number;
      maxAllocPct: number;
    }
  ) {
    const historySlice = closes.slice(0, index + 1);
    const { shouldEnter, latestValues } = this.strategy.evaluate(historySlice);

    let positionDecision: {
      action: 'HOLD' | 'REDUCE' | 'DCA_REBUY';
      qty: number;
      reason: string;
    } = {
      action: 'HOLD',
      qty: 0,
      reason: 'No action required or position not active.',
    };

    if (position) {
      const leverage = config?.leverage ?? 3;
      const profitThresholdPct = config?.profitThresholdPct ?? 15;
      const rebuyThresholdPct = config?.rebuyThresholdPct ?? 15;
      const reducePct = config?.reducePct ?? 15;
      const rebuyQtyPct = config?.rebuyQtyPct ?? 15;

      const currentMarkPrice = closes[index];
      const rawPnl =
        position.side === 'Buy'
          ? (currentMarkPrice - position.avgPrice) * position.size
          : (position.avgPrice - currentMarkPrice) * position.size;
      const positionValue = position.size * position.avgPrice;
      const initialMargin = positionValue / leverage;
      const pnlPct = initialMargin > 0 ? (rawPnl / initialMargin) * 100 : 0;

      if (pnlPct >= profitThresholdPct) {
        const qtyToReduce = position.size * (reducePct / 100);
        positionDecision = {
          action: 'REDUCE' as const,
          qty: parseFloat(qtyToReduce.toFixed(4)),
          reason: `Take Profit triggered. PnL is +${pnlPct.toFixed(2)}% >= +${profitThresholdPct}%. Reducing position size by ${reducePct}%.`,
        };
      } else if (pnlPct <= -rebuyThresholdPct) {
        let skipped = false;
        if (position.lastExecutionPrice && position.lastExecutionSide === 'Buy') {
          const priceDropThreshold = rebuyThresholdPct / leverage;
          const requiredPrice = position.lastExecutionPrice * (1 - priceDropThreshold / 100);
          if (currentMarkPrice > requiredPrice) {
            positionDecision = {
              action: 'HOLD' as const,
              qty: 0,
              reason: `PnL is ${pnlPct.toFixed(2)}% <= -${rebuyThresholdPct}%, but price ($${currentMarkPrice.toFixed(2)}) has not dropped >= ${priceDropThreshold.toFixed(2)}% below last Buy price ($${position.lastExecutionPrice.toFixed(2)}). Skipping rebuy to prevent loop.`,
            };
            skipped = true;
          }
        }
        if (!skipped) {
          const rawRebuyQty = position.size * (rebuyQtyPct / 100);
          positionDecision = {
            action: 'DCA_REBUY' as const,
            qty: parseFloat(rawRebuyQty.toFixed(4)),
            reason: `DCA Rebuy triggered. PnL is ${pnlPct.toFixed(2)}% <= -${rebuyThresholdPct}%. Adding position size by ${rebuyQtyPct}%.`,
          };
        }
      } else {
        positionDecision = {
          action: 'HOLD' as const,
          qty: 0,
          reason: `PnL is ${pnlPct.toFixed(2)}% (within [-${rebuyThresholdPct}%, +${profitThresholdPct}%]). Holding position.`,
        };
      }
    }

    return {
      stepIndex: index,
      evalPrice: closes[index],
      strategySignal: {
        shouldEnter,
        latestValues,
        macdValue: latestValues?.macd ?? 0,
        signalValue: latestValues?.signal ?? 0,
        histValue: latestValues?.histogram ?? 0,
      },
      positionDecision,
    };
  }

  getMinCandles() {
    return MIN_MACD_CANDLES;
  }
}
