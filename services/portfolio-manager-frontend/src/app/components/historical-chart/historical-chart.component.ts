import { Component, inject, ViewChild, ElementRef, ChangeDetectionStrategy, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-historical-chart',
  imports: [CommonModule],
  template: `
    <div class="card chart-container">
      <div class="chart-header flex flex-wrap gap-3">
        <div class="flex items-center gap-3">
          @if (state.selectedAsset()) {
            <div class="w-9 h-9 flex items-center justify-center rounded-full overflow-hidden shadow-lg shrink-0">
              @if (!state.logoErrors().has(state.selectedAsset()!)) {
                <img [src]="state.getLogoUrl(state.selectedAsset()!)" (error)="state.onLogoError(state.selectedAsset()!)" class="w-full h-full rounded-full bg-white object-contain p-0.5" alt="" />
              } @else {
                <div class="w-full h-full flex items-center justify-center text-xs font-bold text-white rounded-full" [style.backgroundColor]="state.getLogoColor(state.selectedAsset()!)">
                  {{ state.selectedAsset()!.substring(0, 2) }}
                </div>
              }
            </div>
          }
          <div>
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Interactive Futures Chart</span>
            <div class="flex items-center gap-2.5">
              <h2 class="text-lg sm:text-xl font-bold text-white">{{ state.selectedAsset() || 'No Asset Selected' }}</h2>
              @if (state.selectedAsset()) {
                <button (click)="state.openOrderModal(state.selectedAsset()!, 'Buy', 1, false, 'Manual Override', state.botLeverage())" class="btn btn-primary btn-small">
                  &#x26A1; Manual Trade
                </button>
              }
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Timeframe:</span>
          <select [value]="state.timeframe()" (change)="onTimeframeChange($any($event.target).value)" class="bg-slate-900 border border-slate-600/70 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-100 cursor-pointer outline-none transition-all focus:border-blue-500">
            <option value="1h">1h (60m)</option>
            <option value="4h">4h (240m)</option>
            <option value="1D">1D (Daily)</option>
          </select>
        </div>
        @if (state.selectedIndex() !== null && state.klines().length > 0) {
          <div class="flex gap-3 bg-slate-900 px-4 py-2 rounded-xl border border-slate-700/50 overflow-x-auto w-full sm:w-auto">
            <div class="flex gap-1 text-xs">
              <span class="text-slate-400 font-semibold">Date:</span>
              <span class="text-amber-400 font-bold whitespace-nowrap">{{ formatCandleDate(state.klines()[state.selectedIndex()!].time) }}</span>
            </div>
            <div class="flex gap-1 text-xs">
              <span class="text-slate-400 font-semibold">O:</span>
              <span class="text-slate-200 font-bold">{{ state.klines()[state.selectedIndex()!].open.toFixed(2) }}</span>
            </div>
            <div class="flex gap-1 text-xs">
              <span class="text-slate-400 font-semibold">H:</span>
              <span class="text-slate-200 font-bold">{{ state.klines()[state.selectedIndex()!].high.toFixed(2) }}</span>
            </div>
            <div class="flex gap-1 text-xs">
              <span class="text-slate-400 font-semibold">L:</span>
              <span class="text-slate-200 font-bold">{{ state.klines()[state.selectedIndex()!].low.toFixed(2) }}</span>
            </div>
            <div class="flex gap-1 text-xs">
              <span class="text-slate-400 font-semibold">C:</span>
              <span class="text-amber-400 font-bold">{{ state.klines()[state.selectedIndex()!].close.toFixed(2) }}</span>
            </div>
          </div>
        }
      </div>

      <div class="p-2.5 bg-slate-900 flex flex-col items-center">
        <canvas #chartCanvas (click)="onChartClick($event)" class="cursor-crosshair bg-slate-900 rounded-lg"></canvas>
        <div class="w-full text-center py-3 text-slate-400 text-xs font-medium border-t border-slate-700/30 mt-2.5">
          <span>&#x1F5B1;&#xFE0F; Click anywhere on the chart timeline to evaluate the bot decisions at that specific interval.</span>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoricalChartComponent {
  state = inject(StateService);

  onTimeframeChange(tf: string) {
    this.state.updateTimeframe(tf);
  }

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  constructor() {
    effect(() => {
      const data = this.state.klines();
      const idx = this.state.selectedIndex();
      if (data.length > 0) {
        setTimeout(() => this.drawChart(), 0);
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
    if (data.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const container = canvas.parentElement;
    const width = container ? Math.max(280, container.clientWidth - 20) : 900;
    const height = 480;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0f172a';
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

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const price = minPrice + (priceRange * i) / 5;
      const y = getY(price);

      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, sans-serif';

      ctx.textAlign = 'right';
      ctx.fillText(price.toFixed(2), paddingLeft - 8, y + 3);

      ctx.textAlign = 'left';
      ctx.fillText(price.toFixed(2), width - paddingRight + 8, y + 3);
    }

    const timeTickCount = 6;
    const timeStep = Math.ceil(data.length / timeTickCount);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';

    for (let i = 0; i < data.length; i += timeStep) {
      const x = getX(i);

      ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
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

    ctx.beginPath();
    ctx.moveTo(getX(0), getY(data[0].close));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(getX(i), getY(data[i].close));
    }
    ctx.lineTo(getX(data.length - 1), getY(minPrice));
    ctx.lineTo(getX(0), getY(minPrice));
    ctx.closePath();

    const areaGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + mainChartHeight);
    areaGrad.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
    areaGrad.addColorStop(1, 'rgba(59, 130, 246, 0.00)');
    ctx.fillStyle = areaGrad;
    ctx.fill();

    const candleWidth = Math.max(2, (width - paddingLeft - paddingRight) / data.length - 1);
    for (let i = 0; i < data.length; i++) {
      const k = data[i];
      const x = getX(i);
      const isGreen = k.close >= k.open;

      ctx.strokeStyle = isGreen ? '#10b981' : '#f43f5e';
      ctx.fillStyle = isGreen ? '#10b981' : '#f43f5e';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2, getY(k.high));
      ctx.lineTo(x + candleWidth / 2, getY(k.low));
      ctx.stroke();

      const bodyY1 = getY(Math.max(k.open, k.close));
      const bodyY2 = getY(Math.min(k.open, k.close));
      const bodyHeight = Math.max(1.5, bodyY2 - bodyY1);

      ctx.fillRect(x, bodyY1, candleWidth, bodyHeight);
    }

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(paddingLeft, macdTop - 10, width - paddingLeft - paddingRight, macdHeight + 20);

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
    ctx.strokeRect(paddingLeft, macdTop - 10, width - paddingLeft - paddingRight, macdHeight + 20);

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

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, getMacdY(0));
    ctx.lineTo(width - paddingRight, getMacdY(0));
    ctx.stroke();

    for (let i = 0; i < data.length; i++) {
      const x = getX(i);
      const h = hist[i];
      const isGreen = h >= 0;
      ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.6)' : 'rgba(244, 63, 94, 0.6)';
      const y0 = getMacdY(0);
      const y1 = getMacdY(h);
      ctx.fillRect(x, Math.min(y0, y1), candleWidth, Math.abs(y0 - y1));
    }

    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(getX(0) + candleWidth / 2, getMacdY(macdLine[0]));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(getX(i) + candleWidth / 2, getMacdY(macdLine[i]));
    }
    ctx.stroke();

    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(getX(0) + candleWidth / 2, getMacdY(signalLine[0]));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(getX(i) + candleWidth / 2, getMacdY(signalLine[i]));
    }
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('MACD', paddingLeft - 8, macdTop + 10);
    ctx.fillText('0.00', paddingLeft - 8, getMacdY(0) + 3);

    if (activeIdx !== null && activeIdx >= 0 && activeIdx < data.length) {
      const x = getX(activeIdx) + candleWidth / 2;

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, height - 15);
      ctx.stroke();
      ctx.setLineDash([]);

      const y = getY(data[activeIdx].close);
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(width - paddingRight + 2, y - 8, 52, 16);
      ctx.fillStyle = '#0f172a';
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(data[activeIdx].close.toFixed(2), width - paddingRight + 6, y + 3);
    }
  }
}
