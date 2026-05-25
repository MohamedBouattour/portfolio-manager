import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Kline, StrategySignal, PositionDecision, EvaluationResult, Position } from '../../types.js';
import { environment } from '../../../environments/environment.dev.js';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private http = inject(HttpClient);
  private apiBase = environment.apiBase;

  // Assets list & search
  assets = signal<string[]>([]);
  searchQuery = signal<string>('');
  filteredAssets = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.assets();
    return this.assets().filter(a => a.toLowerCase().includes(query));
  });

  // Selected Asset & Data
  selectedAsset = signal<string | null>(null);
  klines = signal<Kline[]>([]);
  selectedIndex = signal<number | null>(null);
  evaluationResult = signal<EvaluationResult | null>(null);
  momentumStocks = signal<{ symbol: string; price: number; changePct: number }[]>([]);
  logoErrors = signal<Set<string>>(new Set());
  scoutingResults = signal<any[]>([]);
  latestLog = signal<string>('Loading logs...');
  latestLogTimestamp = signal<number>(0);
  timeframe = signal<string>('1h');
  selectedAssetScouting = computed(() => {
    const asset = this.selectedAsset();
    if (!asset) return null;
    return this.scoutingResults().find(r => r.symbol === asset) || null;
  });

  // Open Positions & Manual Mode states
  openPositions = signal<Position[]>([]);
  manualMode = signal<boolean>(false);
  orderExecuting = signal<boolean>(false);
  orderStatus = signal<string | null>(null);

  // States
  isLoading = signal<boolean>(false);
  isEvaluating = signal<boolean>(false);
  error = signal<string | null>(null);

  // Simulation Params
  simSide = signal<'Buy' | 'Sell' | 'None'>('None');
  simSize = signal<number>(10);
  simAvgPrice = signal<number>(100);
  botLeverage = signal<number>(3);
  botBalance = signal<number>(689);
  profitThresholdPct = signal<number>(15);
  rebuyThresholdPct = signal<number>(15);
  reducePct = signal<number>(15);
  rebuyQtyPct = signal<number>(15);
  maxAllocPct = signal<number>(20);

  // Manual Order Overlay Modal states
  showOrderModal = signal<boolean>(false);
  modalSymbol = signal<string>('');
  modalSide = signal<'Buy' | 'Sell'>('Buy');
  modalQty = signal<number>(1);
  modalLeverage = signal<number>(3);
  modalReduceOnly = signal<boolean>(false);
  modalReason = signal<string>('');

  modalAssetPrice = computed(() => {
    const symbol = this.modalSymbol();
    if (symbol === this.selectedAsset()) {
      const idx = this.selectedIndex();
      const klinesData = this.klines();
      if (idx !== null && klinesData[idx]) {
        return klinesData[idx].close;
      }
    }
    const scout = this.scoutingResults().find(r => r.symbol === symbol);
    if (scout) return scout.price;
    const mom = this.momentumStocks().find(m => m.symbol === symbol);
    if (mom) return mom.price;
    return 0;
  });

  modalNotional = computed(() => {
    const qty = this.modalQty();
    const price = this.modalAssetPrice();
    return parseFloat((qty * price).toFixed(2));
  });

  modalMargin = computed(() => {
    const notional = this.modalNotional();
    const lev = this.modalLeverage();
    if (lev <= 0) return 0;
    return parseFloat((notional / lev).toFixed(2));
  });

  // Computes suggested manual order if there's an active bot entry or position management action
  getSuggestedOrder = computed(() => {
    const evalResult = this.evaluationResult();
    const asset = this.selectedAsset();
    const data = this.klines();
    if (!evalResult || !asset || data.length === 0) return null;

    const lastPrice = evalResult.evalPrice;

    // Check entry signal
    if (evalResult.strategySignal.shouldEnter) {
      const targetNotional = this.botBalance() * (this.maxAllocPct() / 100) * this.botLeverage();
      const rawQty = targetNotional / lastPrice;
      const qty = parseFloat(rawQty.toFixed(4));
      return {
        symbol: asset,
        side: 'Buy' as const,
        qty,
        notional: parseFloat((qty * lastPrice).toFixed(2)),
        margin: parseFloat(((qty * lastPrice) / this.botLeverage()).toFixed(2)),
        reduceOnly: false,
        reason: 'MACD Crossover Entry Signal detected'
      };
    }

    // Check position management action
    const decision = evalResult.positionDecision;
    if (decision && decision.action !== 'HOLD') {
      if (decision.action === 'REDUCE') {
        return {
          symbol: asset,
          side: 'Sell' as const,
          qty: decision.qty,
          notional: parseFloat((decision.qty * lastPrice).toFixed(2)),
          margin: parseFloat(((decision.qty * lastPrice) / this.botLeverage()).toFixed(2)),
          reduceOnly: true,
          reason: decision.reason
        };
      } else if (decision.action === 'DCA_REBUY') {
        return {
          symbol: asset,
          side: 'Buy' as const,
          qty: decision.qty,
          notional: parseFloat((decision.qty * lastPrice).toFixed(2)),
          margin: parseFloat(((decision.qty * lastPrice) / this.botLeverage()).toFixed(2)),
          reduceOnly: false,
          reason: decision.reason
        };
      }
    }

    return null;
  });

  constructor() {
    // Re-evaluate automatically when index or position parameters change
    effect(() => {
      const idx = this.selectedIndex();
      if (idx !== null) {
        // Trigger evaluate on changes to position settings
        this.simSide();
        this.simSize();
        this.simAvgPrice();
        this.botLeverage();
        this.botBalance();
        this.profitThresholdPct();
        this.rebuyThresholdPct();
        this.reducePct();
        this.rebuyQtyPct();
        this.maxAllocPct();

        // Run evaluation
        setTimeout(() => this.triggerEvaluation(), 0);
      }
    });
  }

  initialize() {
    this.fetchAssets();
    this.fetchMomentum();
    this.fetchScoutingStatus();
    this.fetchLatestLog();
    this.fetchConfig();
    this.fetchOpenPositions();
    setInterval(() => {
      this.fetchScoutingStatus();
      this.fetchLatestLog();
      this.fetchOpenPositions();
    }, 30000);
  }

  getPnlPercent(pos: Position): number {
    const margin = (pos.size * pos.avgPrice) / pos.leverage;
    if (margin === 0) return 0;
    return (pos.unrealisedPnl / margin) * 100;
  }

  getPositionDecision(pos: Position): { action: 'HOLD' | 'REDUCE' | 'DCA_REBUY'; qty: number; reason: string } {
    const pnlPct = this.getPnlPercent(pos);
    const profitThreshold = this.profitThresholdPct();
    const rebuyThreshold = this.rebuyThresholdPct();
    const reduce = this.reducePct();
    const rebuyQty = this.rebuyQtyPct();

    if (pnlPct >= profitThreshold) {
      const qtyToReduce = pos.size * (reduce / 100);
      return {
        action: 'REDUCE',
        qty: parseFloat(qtyToReduce.toFixed(4)),
        reason: `Take Profit triggered. PnL is +${pnlPct.toFixed(2)}% >= +${profitThreshold}%. Reducing position size by ${reduce}%.`
      };
    } else if (pnlPct <= -rebuyThreshold) {
      // Loop prevention check
      if (pos.lastExecutionPrice && pos.lastExecutionSide === 'Buy') {
        const priceDropThreshold = rebuyThreshold / pos.leverage;
        const requiredPrice = pos.lastExecutionPrice * (1 - priceDropThreshold / 100);
        if (pos.markPrice > requiredPrice) {
          return {
            action: 'HOLD',
            qty: 0,
            reason: `PnL is ${pnlPct.toFixed(2)}% <= -${rebuyThreshold}%, but price ($${pos.markPrice.toFixed(2)}) has not dropped >= ${priceDropThreshold.toFixed(2)}% below last Buy price ($${pos.lastExecutionPrice.toFixed(2)}). Skipping rebuy to prevent loop.`
          };
        }
      }

      const qty = pos.size * (rebuyQty / 100);
      return {
        action: 'DCA_REBUY',
        qty: parseFloat(qty.toFixed(4)),
        reason: `DCA Rebuy triggered. PnL is ${pnlPct.toFixed(2)}% <= -${rebuyThreshold}%. Adding position size by ${rebuyQty}%.`
      };
    } else {
      return {
        action: 'HOLD',
        qty: 0,
        reason: `PnL is ${pnlPct.toFixed(2)}% (within [-${rebuyThreshold}%, +${profitThreshold}%]). Holding position.`
      };
    }
  }

  fetchConfig() {
    this.http.get<{ timeframe: string; manualMode?: boolean; rebuyQtyPct?: number }>(`${this.apiBase}/config`).subscribe({
      next: (res) => {
        const tf = res.timeframe === 'D' ? '1D' : res.timeframe === '240' ? '4h' : res.timeframe === '60' ? '1h' : res.timeframe;
        this.timeframe.set(tf);
        this.manualMode.set(!!res.manualMode);
        if (res.rebuyQtyPct !== undefined) {
          this.rebuyQtyPct.set(res.rebuyQtyPct);
        }
      },
      error: (err) => {
        console.error('Failed to fetch config', err);
      }
    });
  }

  fetchOpenPositions() {
    this.http.get<Position[]>(`${this.apiBase}/positions`).subscribe({
      next: (data) => {
        this.openPositions.set(data);
      },
      error: (err) => {
        console.error('Failed to load open positions', err);
      }
    });
  }

  openOrderModal(
    symbol: string,
    side: 'Buy' | 'Sell',
    qty: number,
    reduceOnly: boolean,
    reason: string = 'Manual Override',
    leverage?: number
  ) {
    this.modalSymbol.set(symbol);
    this.modalSide.set(side);
    this.modalQty.set(qty);
    this.modalReduceOnly.set(reduceOnly);
    this.modalReason.set(reason);
    this.modalLeverage.set(leverage || this.botLeverage());
    this.showOrderModal.set(true);
  }

  closeOrderModal() {
    this.showOrderModal.set(false);
  }

  executeModalOrder() {
    if (this.orderExecuting()) return;
    this.orderExecuting.set(true);
    this.orderStatus.set('submitting');

    const body = {
      symbol: this.modalSymbol(),
      side: this.modalSide(),
      qty: this.modalQty(),
      reduceOnly: this.modalReduceOnly(),
      leverage: this.modalLeverage()
    };

    this.http.post<any>(`${this.apiBase}/execute-order`, body).subscribe({
      next: (res) => {
        this.orderExecuting.set(false);
        this.orderStatus.set('success');
        this.fetchOpenPositions();
        this.closeOrderModal();
        setTimeout(() => this.orderStatus.set(null), 5000);
      },
      error: (err) => {
        console.error('Failed to execute modal order', err);
        this.orderExecuting.set(false);
        this.orderStatus.set(`error: ${err.error?.message || err.message}`);
        setTimeout(() => this.orderStatus.set(null), 7000);
      }
    });
  }

  fetchMomentum() {
    this.http.get<{ symbol: string; price: number; changePct: number }[]>(`${this.apiBase}/momentum`).subscribe({
      next: (data) => {
        this.momentumStocks.set(data);
      },
      error: (err) => {
        console.error('Failed to load momentum stocks', err);
      }
    });
  }

  fetchScoutingStatus() {
    this.http.get<any[]>(`${this.apiBase}/scouting-status`).subscribe({
      next: (data) => {
        this.scoutingResults.set(data);
      },
      error: (err) => {
        console.error('Failed to load scouting status', err);
      }
    });
  }

  fetchLatestLog() {
    this.http.get<{ timestamp: number; content: string }>(`${this.apiBase}/logs/latest`).subscribe({
      next: (res) => {
        this.latestLog.set(res.content);
        this.latestLogTimestamp.set(res.timestamp);
      },
      error: (err) => {
        console.error('Failed to load latest log', err);
      }
    });
  }

  fetchAssets() {
    this.isLoading.set(true);
    this.http.get<string[]>(`${this.apiBase}/stocks`).subscribe({
      next: (data) => {
        this.assets.set(data);
        this.isLoading.set(false);
        if (data.length > 0) {
          this.selectAsset(data[0]);
        }
      },
      error: (err) => {
        this.error.set('Failed to fetch assets catalog.');
        this.isLoading.set(false);
      }
    });
  }

  selectAsset(asset: string) {
    this.selectedAsset.set(asset);
    this.searchQuery.set('');
    this.klines.set([]);
    this.selectedIndex.set(null);
    this.evaluationResult.set(null);
    this.isLoading.set(true);
    this.error.set(null);

    this.http.get<Kline[]>(`${this.apiBase}/klines?symbol=${asset}`).subscribe({
      next: (data) => {
        this.klines.set(data);
        this.isLoading.set(false);
        if (data.length > 0) {
          // Select the last candle by default
          const lastIdx = data.length - 1;
          this.selectedIndex.set(lastIdx);
          this.simAvgPrice.set(parseFloat(data[Math.max(0, lastIdx - 10)].close.toFixed(2)));
        }
      },
      error: (err) => {
        this.error.set(`Failed to load historical charts for ${asset}.`);
        this.isLoading.set(false);
      }
    });
  }

  getLogoColor(symbol: string): string {
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 60%, 40%)`;
  }

  hasScoutingSignal(symbol: string): boolean {
    const res = this.scoutingResults().find(r => r.symbol === symbol);
    return res ? res.shouldEnter : false;
  }

  getUptrendAssets(): any[] {
    return this.scoutingResults().filter(r => r.shouldEnter);
  }

  getLogoUrl(symbol: string): string {
    return `logos/${symbol}.png`;
  }

  onLogoError(symbol: string) {
    this.logoErrors.update(set => {
      const newSet = new Set(set);
      newSet.add(symbol);
      return newSet;
    });
  }

  triggerEvaluation() {
    const idx = this.selectedIndex();
    const asset = this.selectedAsset();
    const data = this.klines();
    if (idx === null || !asset || data.length === 0) return;

    this.isEvaluating.set(true);

    const closes = data.map(k => k.close);
    const body: any = {
      closes,
      index: idx,
      config: {
        leverage: this.botLeverage(),
        balance: this.botBalance(),
        profitThresholdPct: this.profitThresholdPct(),
        rebuyThresholdPct: this.rebuyThresholdPct(),
        reducePct: this.reducePct(),
        rebuyQtyPct: this.rebuyQtyPct(),
        maxAllocPct: this.maxAllocPct(),
      }
    };

    if (this.simSide() !== 'None') {
      const activePosition = this.openPositions().find(p => p.symbol === asset);
      body.position = {
        side: this.simSide(),
        size: this.simSize(),
        avgPrice: this.simAvgPrice(),
        markPrice: data[idx].close,
        lastExecutionPrice: activePosition?.lastExecutionPrice,
        lastExecutionSide: activePosition?.lastExecutionSide,
      };
    }

    this.http.post<EvaluationResult>(`${this.apiBase}/evaluate`, body).subscribe({
      next: (res) => {
        this.evaluationResult.set(res);
        this.isEvaluating.set(false);
      },
      error: (err) => {
        console.error('Evaluation call failed', err);
        this.isEvaluating.set(false);
      }
    });
  }
}
