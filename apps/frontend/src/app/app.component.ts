import { Component, OnInit, signal, computed, effect, inject, ElementRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StrategySignal {
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

interface PositionDecision {
  action: 'HOLD' | 'REDUCE' | 'DCA_REBUY';
  qty: number;
  reason: string;
}

interface EvaluationResult {
  stepIndex: number;
  evalPrice: number;
  strategySignal: StrategySignal;
  positionDecision: PositionDecision;
}

interface Position {
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

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:keydown)': 'handleKeyDown($event)'
  }
})
export class AppComponent implements OnInit {
  private http = inject(HttpClient);
  private apiBase = 'http://localhost:3000/api';

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

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

  // Manual Order Overlay Modal states
  showOrderModal = signal<boolean>(false);
  modalSymbol = signal<string>('');
  modalSide = signal<'Buy' | 'Sell'>('Buy');
  modalQty = signal<number>(1);
  modalLeverage = signal<number>(3);
  modalReduceOnly = signal<boolean>(false);
  modalReason = signal<string>('');

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
    const rebuyQtyPct = this.rebuyQtyPct();

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

      const qty = pos.size * (rebuyQtyPct / 100);
      return {
        action: 'DCA_REBUY',
        qty: parseFloat(qty.toFixed(4)),
        reason: `DCA Rebuy triggered. PnL is ${pnlPct.toFixed(2)}% <= -${rebuyThreshold}%. Adding position size by ${rebuyQtyPct}%.`
      };
    } else {
      return {
        action: 'HOLD',
        qty: 0,
        reason: `PnL is ${pnlPct.toFixed(2)}% (within [-${rebuyThreshold}%, +${profitThreshold}%]). Holding position.`
      };
    }
  }

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

  constructor() {
    // Redraw the chart reactively when klines or selection changes
    effect(() => {
      const data = this.klines();
      const idx = this.selectedIndex();
      if (data.length > 0) {
        // Queue the draw after Angular completes rendering to ensure canvas element exists
        setTimeout(() => this.drawChart(), 0);
      }
    });

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

  ngOnInit() {
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

  confirmOrder(symbol: string, side: 'Buy' | 'Sell', qty: number, reduceOnly: boolean, leverage?: number) {
    if (this.orderExecuting()) return;
    this.orderExecuting.set(true);
    this.orderStatus.set('submitting');

    const body = { symbol, side, qty, reduceOnly, leverage };
    this.http.post<any>(`${this.apiBase}/execute-order`, body).subscribe({
      next: (res) => {
        this.orderExecuting.set(false);
        this.orderStatus.set('success');
        this.fetchOpenPositions();
        setTimeout(() => this.orderStatus.set(null), 5000);
      },
      error: (err) => {
        console.error('Failed to execute order', err);
        this.orderExecuting.set(false);
        this.orderStatus.set(`error: ${err.error?.message || err.message}`);
        setTimeout(() => this.orderStatus.set(null), 7000);
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

  handleKeyDown(event: KeyboardEvent) {
    const activeEl = document.activeElement;
    if (activeEl) {
      const tagName = activeEl.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return;
      }
    }

    const data = this.klines();
    if (data.length === 0) return;

    const currentIdx = this.selectedIndex();
    if (currentIdx === null) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const nextIdx = Math.max(0, currentIdx - 1);
      this.selectedIndex.set(nextIdx);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      const nextIdx = Math.min(data.length - 1, currentIdx + 1);
      this.selectedIndex.set(nextIdx);
    }
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

  formatCandleDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const yyyy = date.getFullYear();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const hh = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }

  getUptrendAssets(): any[] {
    return this.scoutingResults().filter(r => r.shouldEnter);
  }

  getLogoUrl(symbol: string): string {
    return `/logos/${symbol}.png`;
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

  onChartClick(event: MouseEvent) {
    const canvas = this.chartCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    
    // Map view client coordinates to logical drawing coordinates of width=900
    const x = ((event.clientX - rect.left) / rect.width) * 900;
    const data = this.klines();
    if (data.length === 0) return;

    const paddingLeft = 55;
    const paddingRight = 60; // matches drawChart
    const chartWidth = 900 - paddingLeft - paddingRight;

    // Map x relative to chart width
    const xRelative = x - paddingLeft;
    if (xRelative < 0 || xRelative > chartWidth) return;

    const candleWidth = chartWidth / data.length;
    const index = Math.floor(xRelative / candleWidth);
    if (index >= 0 && index < data.length) {
      this.selectedIndex.set(index);
    }
  }

  drawChart() {
    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = this.klines();
    const activeIdx = this.selectedIndex();
    if (data.length === 0) return;

    // Enable high DPI support
    const dpr = window.devicePixelRatio || 1;
    const width = 900;
    const height = 480;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Dark layout background
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, width, height);

    // Padding settings
    const paddingLeft = 55;
    const paddingRight = 60; // wider to fit price labels perfectly
    const paddingTop = 30;
    const paddingBottom = 160; // bottom space for MACD / indicators

    const mainChartHeight = height - paddingTop - paddingBottom;
    const macdTop = height - 110;
    const macdHeight = 70;

    // Price scaling
    const prices = data.map(k => [k.high, k.low]).flat();
    const minPrice = Math.min(...prices) * 0.995;
    const maxPrice = Math.max(...prices) * 1.005;
    const priceRange = maxPrice - minPrice;

    const getX = (i: number) => paddingLeft + (i * (width - paddingLeft - paddingRight)) / data.length;
    const getY = (p: number) => paddingTop + mainChartHeight - ((p - minPrice) / priceRange) * mainChartHeight;

    // 1. Draw Grid Lines (Horizontal Price Grid) & Price Axis Labels (Left & Right)
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)'; // slate-700
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const price = minPrice + (priceRange * i) / 5;
      const y = getY(price);
      
      // Horizontal grid line
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8'; // slate-400
      ctx.font = '10px Inter, sans-serif';
      
      // Left price axis labels
      ctx.textAlign = 'right';
      ctx.fillText(price.toFixed(2), paddingLeft - 8, y + 3);

      // Right price axis labels
      ctx.textAlign = 'left';
      ctx.fillText(price.toFixed(2), width - paddingRight + 8, y + 3);
    }

    // 2. Draw Vertical Grid Lines & Time Axis Labels (Bottom & Middle)
    const timeTickCount = 6;
    const timeStep = Math.ceil(data.length / timeTickCount);
    ctx.fillStyle = '#94a3b8'; // slate-400
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    for (let i = 0; i < data.length; i += timeStep) {
      const x = getX(i);
      
      // Draw vertical alignment grid line
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, macdTop + macdHeight + 10);
      ctx.stroke();

      // Format Date (e.g. "2026-05-23" or "05-23 14:00")
      const date = new Date(data[i].time * 1000);
      const yyyy = date.getFullYear();
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const d = date.getDate().toString().padStart(2, '0');
      const hh = date.getHours().toString().padStart(2, '0');
      const min = date.getMinutes().toString().padStart(2, '0');
      const timeStr = this.timeframe().includes('D') ? `${yyyy}-${m}-${d}` : `${m}-${d} ${hh}:${min}`;

      // Label below main price chart (in the middle gap)
      ctx.fillText(timeStr, x, paddingTop + mainChartHeight + 18);

      // Label at the bottom of the canvas (below MACD chart)
      ctx.fillText(timeStr, x, macdTop + macdHeight + 22);
    }

    // 3. Draw Price Area Gradient
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(data[0].close));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(getX(i), getY(data[i].close));
    }
    ctx.lineTo(getX(data.length - 1), getY(minPrice));
    ctx.lineTo(getX(0), getY(minPrice));
    ctx.closePath();

    const areaGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + mainChartHeight);
    areaGrad.addColorStop(0, 'rgba(59, 130, 246, 0.15)'); // blue-500
    areaGrad.addColorStop(1, 'rgba(59, 130, 246, 0.00)');
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // 4. Draw Candlesticks
    const candleWidth = Math.max(2, (width - paddingLeft - paddingRight) / data.length - 1);
    for (let i = 0; i < data.length; i++) {
      const k = data[i];
      const x = getX(i);
      const isGreen = k.close >= k.open;

      ctx.strokeStyle = isGreen ? '#10b981' : '#f43f5e'; // emerald-500 / rose-500
      ctx.fillStyle = isGreen ? '#10b981' : '#f43f5e';
      ctx.lineWidth = 1.5;

      // Wick
      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2, getY(k.high));
      ctx.lineTo(x + candleWidth / 2, getY(k.low));
      ctx.stroke();

      // Body
      const bodyY1 = getY(Math.max(k.open, k.close));
      const bodyY2 = getY(Math.min(k.open, k.close));
      const bodyHeight = Math.max(1.5, bodyY2 - bodyY1);

      ctx.fillRect(x, bodyY1, candleWidth, bodyHeight);
    }

    // 5. Draw MACD Indicator in the bottom panel
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(paddingLeft, macdTop - 10, width - paddingLeft - paddingRight, macdHeight + 20);

    // Render MACD indicator borders
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.strokeRect(paddingLeft, macdTop - 10, width - paddingLeft - paddingRight, macdHeight + 20);

    // Compute simple MACD for display on chart
    const closes = data.map(k => k.close);
    const ema = (period: number) => {
      const values: number[] = [];
      const k = 2 / (period + 1);
      let prev = closes[0];
      values.push(prev);
      for (let i = 1; i < closes.length; i++) {
        const val = closes[i] * k + prev * (1 - k);
        values.push(val);
        prev = val;
      }
      return values;
    };

    const ema12 = ema(12);
    const ema26 = ema(26);
    const macdLine = ema12.map((val, idx) => val - ema26[idx]);

    // Signal line is 9 EMA of MACD
    const signalLine: number[] = [];
    const kSig = 2 / (9 + 1);
    let prevSig = macdLine[0];
    signalLine.push(prevSig);
    for (let i = 1; i < macdLine.length; i++) {
      const val = macdLine[i] * kSig + prevSig * (1 - kSig);
      signalLine.push(val);
      prevSig = val;
    }

    const hist = macdLine.map((val, idx) => val - signalLine[idx]);

    // Scale MACD
    const macdValues = [...macdLine, ...signalLine, ...hist];
    const maxMacd = Math.max(...macdValues.map(Math.abs)) * 1.05 || 1;
    const getMacdY = (val: number) => macdTop + macdHeight / 2 - (val / maxMacd) * (macdHeight / 2);

    // MACD Zero Line
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, getMacdY(0));
    ctx.lineTo(width - paddingRight, getMacdY(0));
    ctx.stroke();

    // MACD Histogram Bars
    for (let i = 0; i < data.length; i++) {
      const x = getX(i);
      const h = hist[i];
      const isGreen = h >= 0;
      ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.6)' : 'rgba(244, 63, 94, 0.6)';
      const y0 = getMacdY(0);
      const y1 = getMacdY(h);
      ctx.fillRect(x, Math.min(y0, y1), candleWidth, Math.abs(y0 - y1));
    }

    // MACD Line (Blue)
    ctx.strokeStyle = '#60a5fa'; // blue-400
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(getX(0) + candleWidth / 2, getMacdY(macdLine[0]));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(getX(i) + candleWidth / 2, getMacdY(macdLine[i]));
    }
    ctx.stroke();

    // Signal Line (Orange)
    ctx.strokeStyle = '#fb923c'; // orange-400
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(getX(0) + candleWidth / 2, getMacdY(signalLine[0]));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(getX(i) + candleWidth / 2, getMacdY(signalLine[i]));
    }
    ctx.stroke();

    // MACD Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('MACD', paddingLeft - 8, macdTop + 10);
    ctx.fillText('0.00', paddingLeft - 8, getMacdY(0) + 3);

    // 6. Highlight Selected Index
    if (activeIdx !== null && activeIdx >= 0 && activeIdx < data.length) {
      const x = getX(activeIdx) + candleWidth / 2;

      // Draw vertical cursor line across both subplots
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)'; // amber-400
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, height - 15);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Draw highlighting dot on close price
      const y = getY(data[activeIdx].close);
      ctx.fillStyle = '#fbbf24'; // amber-400
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Draw price bubble on the right axis
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(width - paddingRight + 2, y - 8, 52, 16);
      ctx.fillStyle = '#0f172a';
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(data[activeIdx].close.toFixed(2), width - paddingRight + 6, y + 3);
    }
  }
}
