import { Component, inject, ViewChild, ElementRef, ChangeDetectionStrategy, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-historical-chart',
  imports: [CommonModule],
  template: `
    <div class="bg-[#141d24]/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      
      <!-- Chart Controls Header -->
      <div class="px-5 py-4 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-4 bg-[#18232c]/50">
        <div class="flex items-center gap-3">
          @if (state.selectedAsset()) {
            <!-- Selected asset pill -->
            <div class="bg-[#0f161c] px-3.5 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
              <div class="w-5 h-5 flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-slate-900 border border-white/5 p-0.5">
                @if (!state.logoErrors().has(state.selectedAsset()!)) {
                  <img [src]="state.getLogoUrl(state.selectedAsset()!)" (error)="state.onLogoError(state.selectedAsset()!)" class="w-full h-full rounded-full object-contain bg-white" alt="" />
                } @else {
                  <div class="w-full h-full flex items-center justify-center text-[10px] font-bold text-white rounded-full" [style.backgroundColor]="state.getLogoColor(state.selectedAsset()!)">
                    {{ state.selectedAsset()!.substring(0, 2) }}
                  </div>
                }
              </div>
              <span class="text-sm font-extrabold text-white tracking-wide">{{ state.selectedAsset() }}</span>
            </div>

            <!-- Solid green Manual Trade button -->
            <button
              (click)="state.openOrderModal(state.selectedAsset()!, 'Buy', 1, false, 'Manual Override', state.botLeverage())"
              class="px-4 py-1.5 bg-[#10b981] hover:bg-[#0ea5e9] hover:shadow-[0_0_12px_#0ea5e9] text-slate-950 hover:text-white font-extrabold text-xs rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
            >
              Manual Trade
            </button>
          } @else {
            <span class="text-xs font-bold text-slate-400">Select an asset to view chart</span>
          }
        </div>

        <!-- Right Side: Timeframe Selector and Layout tools mock -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5">
            <button
              [ngClass]="state.timeframe() === '1h' ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30' : 'text-[#8696a0] border-slate-800'"
              (click)="onTimeframeChange('1h')"
              class="px-2.5 py-1 bg-slate-900 border text-xs font-bold rounded-lg cursor-pointer transition-all hover:text-white"
            >
              1h
            </button>
            <button
              [ngClass]="state.timeframe() === '4h' ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30' : 'text-[#8696a0] border-slate-800'"
              (click)="onTimeframeChange('4h')"
              class="px-2.5 py-1 bg-slate-900 border text-xs font-bold rounded-lg cursor-pointer transition-all hover:text-white"
            >
              4h
            </button>
            <button
              [ngClass]="state.timeframe() === '1D' ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30' : 'text-[#8696a0] border-slate-800'"
              (click)="onTimeframeChange('1D')"
              class="px-2.5 py-1 bg-slate-900 border text-xs font-bold rounded-lg cursor-pointer transition-all hover:text-white"
            >
              1D
            </button>
          </div>

          <!-- TradingView tools row mock -->
          <div class="hidden sm:flex items-center gap-1 bg-[#0d131a] px-2 py-1 rounded-lg border border-slate-800">
            <span class="text-slate-400 text-xs px-1 hover:text-slate-200 cursor-pointer" title="Indicators">&#x1f4ca;</span>
            <span class="text-slate-400 text-xs px-1 hover:text-slate-200 cursor-pointer" title="Settings">&#x2699;</span>
            <span class="text-slate-400 text-xs px-1 hover:text-slate-200 cursor-pointer" title="Full Screen">&#x26f6;</span>
          </div>
        </div>
      </div>

      <!-- Selected candle values banner -->
      @if (state.selectedIndex() !== null && state.klines().length > 0) {
        @let kline = state.klines()[state.selectedIndex()!];
        <div class="bg-[#0f161c] px-5 py-2.5 border-b border-slate-800/60 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-[#8696a0] font-mono tabular-nums">
          <div class="flex gap-1.5">
            <span class="font-bold text-slate-400">DATE</span>
            <span class="text-amber-400 font-extrabold">{{ formatCandleDate(kline.time) }}</span>
          </div>
          <div class="flex gap-1">
            <span class="font-bold text-slate-400">O</span>
            <span class="text-slate-200 font-bold">\${{ kline.open.toFixed(2) }}</span>
          </div>
          <div class="flex gap-1">
            <span class="font-bold text-slate-400">H</span>
            <span class="text-[#10b981] font-bold">\${{ kline.high.toFixed(2) }}</span>
          </div>
          <div class="flex gap-1">
            <span class="font-bold text-slate-400">L</span>
            <span class="text-rose-500 font-bold">\${{ kline.low.toFixed(2) }}</span>
          </div>
          <div class="flex gap-1">
            <span class="font-bold text-slate-400">C</span>
            <span class="text-slate-200 font-bold">\${{ kline.close.toFixed(2) }}</span>
          </div>
          <div class="flex gap-1 ml-auto">
            <span class="font-bold text-slate-400">VOL</span>
            <span class="text-slate-300 font-bold">{{ kline.volume ? kline.volume.toLocaleString() : '---' }}</span>
          </div>
        </div>
      }

      <!-- Canvas Area -->
      <div class="p-4 bg-[#0d131a] flex flex-col items-center relative min-h-[480px]">
        @if (state.isChartLoading()) {
          <div class="absolute inset-0 p-5 flex flex-col justify-between bg-[#0d131a] z-10">
            <!-- Simulated grid lines and pulsing/shimmering charts -->
            <div class="flex-1 flex flex-col gap-6 justify-between border-b border-slate-850 pb-6 relative">
              @for (row of [1, 2, 3, 4]; track row) {
                <div class="w-full h-[1px] bg-slate-850 relative">
                  <div class="absolute -top-2 left-2 h-3 w-10 rounded skeleton-shimmer opacity-30"></div>
                  <div class="absolute -top-2 right-2 h-3 w-10 rounded skeleton-shimmer opacity-30"></div>
                </div>
              }
              <!-- Shimmering candlesticks mock silhouette -->
              <div class="absolute inset-x-12 bottom-12 top-6 flex items-end justify-around">
                @for (barHeight of [40, 60, 30, 80, 50, 70, 90, 65, 45, 85, 55, 75]; track barHeight) {
                  <div class="flex flex-col items-center gap-1 w-3 sm:w-5">
                    <div class="w-[1.5px] h-12 skeleton-shimmer opacity-20"></div>
                    <div class="w-full rounded skeleton-shimmer" [style.height.px]="barHeight" [style.opacity]="0.15"></div>
                    <div class="w-[1.5px] h-8 skeleton-shimmer opacity-20"></div>
                  </div>
                }
              </div>
            </div>
            
            <!-- MACD Pane Mock in Skeleton -->
            <div class="h-[90px] border border-slate-850 bg-[#0a0e14]/50 rounded-xl relative overflow-hidden p-3 flex flex-col justify-between mt-4">
              <div class="w-12 h-3 rounded skeleton-shimmer opacity-40"></div>
              <div class="w-full h-[1px] bg-slate-850"></div>
              <div class="absolute inset-x-6 bottom-3 top-6 flex items-end justify-around">
                @for (macdBar of [20, 15, 30, 10, 25, 10, 20, 15, 5, 30, 15, 10]; track macdBar) {
                  <div class="w-3 rounded skeleton-shimmer" 
                       [style.height.px]="macdBar" 
                       [style.opacity]="0.25"></div>
                }
              </div>
            </div>
          </div>
        }

        <canvas #chartCanvas (click)="onChartClick($event)" class="cursor-crosshair bg-[#0d131a] w-full rounded-xl" [class.invisible]="state.isChartLoading()"></canvas>
        
        <div class="w-full text-center py-2.5 text-slate-400 text-xs font-bold tracking-wide border-t border-slate-800/60 mt-3 flex items-center justify-center gap-1 bg-[#10171e]/30 rounded-lg">
          <span>🖱️ Click chart timeline to evaluate trading bot decisions at that interval. Use arrow keys ◀ ▶ to navigate.</span>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoricalChartComponent {
  state = inject(StateService);
  Math = Math;

  onTimeframeChange(tf: string) {
    this.state.updateTimeframe(tf);
  }

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  constructor() {
    effect(() => {
      const data = this.state.klines();
      const activeIdx = this.state.selectedIndex();
      if (data.length > 0) {
        setTimeout(() => this.drawChart(), 0);
      } else {
        this.drawChart();
      }
    });
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

  @HostListener('window:resize')
  onResize() {
    this.drawChart();
  }

  onChartClick(event: MouseEvent) {
    const canvas = this.chartCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const data = this.state.klines();
    if (data.length === 0) return;

    const paddingLeft = 55;
    const paddingRight = 60;
    const chartWidth = rect.width - paddingLeft - paddingRight;

    const xRelative = x - paddingLeft;
    if (xRelative < 0 || xRelative > chartWidth) return;

    const candleWidth = chartWidth / data.length;
    const index = Math.floor(xRelative / candleWidth);
    if (index >= 0 && index < data.length) {
      this.state.selectedIndex.set(index);
    }
  }

  drawChart() {
    if (!this.chartCanvas) return;
    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = this.state.klines();
    const activeIdx = this.state.selectedIndex();
    if (data.length === 0) {
      ctx.fillStyle = '#0d131a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const container = canvas.parentElement;
    const width = container ? Math.max(280, container.clientWidth - 32) : 900;
    const height = 480;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Background color matching dark TradingView chart background
    ctx.fillStyle = '#0d131a';
    ctx.fillRect(0, 0, width, height);

    const paddingLeft = 55;
    const paddingRight = 60;
    const paddingTop = 30;
    const paddingBottom = 160;

    const mainChartHeight = height - paddingTop - paddingBottom;
    const macdTop = height - 110;
    const macdHeight = 70;

    const prices = data.map(k => [k.high, k.low]).flat();
    const minPrice = Math.min(...prices) * 0.995;
    const maxPrice = Math.max(...prices) * 1.005;
    const priceRange = maxPrice - minPrice;

    const getX = (i: number) => paddingLeft + (i * (width - paddingLeft - paddingRight)) / data.length;
    const getY = (p: number) => paddingTop + mainChartHeight - ((p - minPrice) / priceRange) * mainChartHeight;

    // Draw Price grid lines (horizontal) and price axis labels
    ctx.strokeStyle = '#1b232c';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const price = minPrice + (priceRange * i) / 5;
      const y = getY(price);

      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      ctx.fillStyle = '#8696a0';
      ctx.font = 'bold 9px monospace';

      ctx.textAlign = 'right';
      ctx.fillText(price.toFixed(2), paddingLeft - 8, y + 3);

      ctx.textAlign = 'left';
      ctx.fillText(price.toFixed(2), width - paddingRight + 8, y + 3);
    }

    // Draw timeline vertical grids and time labels
    const timeTickCount = 6;
    const timeStep = Math.ceil(data.length / timeTickCount);
    ctx.fillStyle = '#8696a0';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i < data.length; i += timeStep) {
      const x = getX(i);

      ctx.strokeStyle = '#1b232c';
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, macdTop + macdHeight + 10);
      ctx.stroke();

      const date = new Date(data[i].time * 1000);
      const yyyy = date.getFullYear();
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const d = date.getDate().toString().padStart(2, '0');
      const hh = date.getHours().toString().padStart(2, '0');
      const min = date.getMinutes().toString().padStart(2, '0');
      const timeStr = this.state.timeframe().includes('D') ? `${yyyy}-${m}-${d}` : `${m}-${d} ${hh}:${min}`;

      ctx.fillText(timeStr, x, paddingTop + mainChartHeight + 18);
      ctx.fillText(timeStr, x, macdTop + macdHeight + 22);
    }

    // 1. Draw Volume Bars at the bottom of the price pane
    const maxVolume = Math.max(...data.map(k => k.volume || 0)) || 1;
    const candleWidth = Math.max(2, (width - paddingLeft - paddingRight) / data.length - 1.5);
    const volHeightMax = mainChartHeight * 0.25; // max 25% of height

    for (let i = 0; i < data.length; i++) {
      const k = data[i];
      const x = getX(i);
      const isGreen = k.close >= k.open;
      const volHeight = ((k.volume || 0) / maxVolume) * volHeightMax;
      
      ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)';
      ctx.fillRect(x, paddingTop + mainChartHeight - volHeight, candleWidth, volHeight);
    }

    // 2. Draw Moving Average (MA) curves on the main pane
    const calculateSMA = (period: number) => {
      const values: number[] = [];
      for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
          values.push(data[i].close);
        } else {
          let sum = 0;
          for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
          }
          values.push(sum / period);
        }
      }
      return values;
    };

    const sma7 = calculateSMA(7);
    const sma25 = calculateSMA(25);
    const sma99 = calculateSMA(99);

    const drawMA = (values: number[], color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(getX(0) + candleWidth / 2, getY(values[0]));
      for (let i = 1; i < data.length; i++) {
        ctx.lineTo(getX(i) + candleWidth / 2, getY(values[i]));
      }
      ctx.stroke();
    };

    drawMA(sma7, '#fbbf24');      // SMA 7: yellow
    drawMA(sma25, '#0ea5e9');     // SMA 25: blue
    drawMA(sma99, '#ec4899');     // SMA 99: pink/red

    // 3. Draw Candlestick bars
    for (let i = 0; i < data.length; i++) {
      const k = data[i];
      const x = getX(i);
      const isGreen = k.close >= k.open;

      ctx.strokeStyle = isGreen ? '#10b981' : '#f43f5e';
      ctx.fillStyle = isGreen ? '#10b981' : '#f43f5e';
      ctx.lineWidth = 1.2;

      // Draw wick
      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2, getY(k.high));
      ctx.lineTo(x + candleWidth / 2, getY(k.low));
      ctx.stroke();

      // Draw body
      const bodyY1 = getY(Math.max(k.open, k.close));
      const bodyY2 = getY(Math.min(k.open, k.close));
      const bodyHeight = Math.max(1.5, bodyY2 - bodyY1);

      ctx.fillRect(x, bodyY1, candleWidth, bodyHeight);
    }

    // 4. Draw MACD Pane Background & Borders
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(paddingLeft, macdTop - 10, width - paddingLeft - paddingRight, macdHeight + 20);

    ctx.strokeStyle = '#1b232c';
    ctx.strokeRect(paddingLeft, macdTop - 10, width - paddingLeft - paddingRight, macdHeight + 20);

    // MACD logic calculations
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

    const macdValues = [...macdLine, ...signalLine, ...hist];
    const maxMacd = Math.max(...macdValues.map(Math.abs)) * 1.05 || 1;
    const getMacdY = (val: number) => macdTop + macdHeight / 2 - (val / maxMacd) * (macdHeight / 2);

    // MACD 0 midline
    ctx.strokeStyle = '#1b232c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, getMacdY(0));
    ctx.lineTo(width - paddingRight, getMacdY(0));
    ctx.stroke();

    // MACD Histogram bars
    for (let i = 0; i < data.length; i++) {
      const x = getX(i);
      const h = hist[i];
      const isGreen = h >= 0;
      ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)';
      const y0 = getMacdY(0);
      const y1 = getMacdY(h);
      ctx.fillRect(x, Math.min(y0, y1), candleWidth, Math.abs(y0 - y1));
    }

    // MACD line (cyan/blue)
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(getX(0) + candleWidth / 2, getMacdY(macdLine[0]));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(getX(i) + candleWidth / 2, getMacdY(macdLine[i]));
    }
    ctx.stroke();

    // MACD Signal line (orange)
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(getX(0) + candleWidth / 2, getMacdY(signalLine[0]));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(getX(i) + candleWidth / 2, getMacdY(signalLine[i]));
    }
    ctx.stroke();

    // MACD pane tags
    ctx.fillStyle = '#8696a0';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('MACD', paddingLeft - 8, macdTop + 10);
    ctx.fillText('0.00', paddingLeft - 8, getMacdY(0) + 3);

    // 5. Draw active timeline selected candle vertical line
    if (activeIdx !== null && activeIdx >= 0 && activeIdx < data.length) {
      const x = getX(activeIdx) + candleWidth / 2;

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([3, 3]);

      // Draw vertical crosshair line
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, height - 15);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw price intersect point
      const y = getY(data[activeIdx].close);
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Draw price text badge on right axis
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(width - paddingRight + 2, y - 8, 52, 16);
      ctx.fillStyle = '#0b0f14';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(data[activeIdx].close.toFixed(2), width - paddingRight + 6, y + 3);
    }
  }
}
