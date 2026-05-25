import { Component, inject, ViewChild, ElementRef, ChangeDetectionStrategy, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-historical-chart',
  imports: [CommonModule],
  template: `
    <div class="chart-container card">
      <div class="chart-header">
        <div class="title-area flex-align-center">
          @if (state.selectedAsset()) {
            <div class="header-logo-container">
              @if (!state.logoErrors().has(state.selectedAsset()!)) {
                <img 
                  [src]="state.getLogoUrl(state.selectedAsset()!)" 
                  (error)="state.onLogoError(state.selectedAsset()!)" 
                  class="header-company-logo"
                  alt=""
                />
              } @else {
                <div class="header-initials-logo" [style.backgroundColor]="state.getLogoColor(state.selectedAsset()!)">
                  {{ state.selectedAsset()!.substring(0, 2) }}
                </div>
              }
            </div>
          }
          <div>
            <span class="label">Interactive Futures Chart</span>
            <div class="flex-row align-center gap-10">
              <h2 class="asset-title">{{ state.selectedAsset() || 'No Asset Selected' }}</h2>
              @if (state.selectedAsset()) {
                <button 
                  (click)="state.openOrderModal(state.selectedAsset()!, 'Buy', 1, false, 'Manual Override', state.botLeverage())" 
                  class="btn btn-primary btn-small btn-manual-trade"
                >
                  ⚡ Manual Trade
                </button>
              }
            </div>
          </div>
        </div>
        @if (state.selectedIndex() !== null && state.klines().length > 0) {
          <div class="selected-candle-details">
            <div class="detail-pill">
              <span class="pill-label">Date:</span>
              <span class="pill-val Highlight">{{ formatCandleDate(state.klines()[state.selectedIndex()!].time) }}</span>
            </div>
            <div class="detail-pill">
              <span class="pill-label">O:</span>
              <span class="pill-val">{{ state.klines()[state.selectedIndex()!].open.toFixed(2) }}</span>
            </div>
            <div class="detail-pill">
              <span class="pill-label">H:</span>
              <span class="pill-val">{{ state.klines()[state.selectedIndex()!].high.toFixed(2) }}</span>
            </div>
            <div class="detail-pill">
              <span class="pill-label">L:</span>
              <span class="pill-val">{{ state.klines()[state.selectedIndex()!].low.toFixed(2) }}</span>
            </div>
            <div class="detail-pill">
              <span class="pill-label">C:</span>
              <span class="pill-val Highlight">{{ state.klines()[state.selectedIndex()!].close.toFixed(2) }}</span>
            </div>
          </div>
        }
      </div>
      
      <!-- Canvas Element -->
      <div class="canvas-wrapper">
        <canvas #chartCanvas (click)="onChartClick($event)"></canvas>
        <div class="chart-instruction">
          <span>🖱️ Click anywhere on the chart timeline to evaluate the bot decisions at that specific interval.</span>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoricalChartComponent {
  state = inject(StateService);

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  constructor() {
    // Redraw the chart reactively when klines or selection changes
    effect(() => {
      const data = this.state.klines();
      const idx = this.state.selectedIndex();
      if (data.length > 0) {
        // Queue the draw after Angular completes rendering to ensure canvas element exists
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
    
    // Map view client coordinates to logical drawing coordinates
    const x = event.clientX - rect.left;
    const data = this.state.klines();
    if (data.length === 0) return;

    const paddingLeft = 55;
    const paddingRight = 60; // matches drawChart
    const chartWidth = rect.width - paddingLeft - paddingRight;

    // Map x relative to chart width
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

    // Enable high DPI support
    const dpr = window.devicePixelRatio || 1;
    const container = canvas.parentElement;
    const width = container ? Math.max(400, container.clientWidth - 20) : 900;
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

      // Format Date
      const date = new Date(data[i].time * 1000);
      const yyyy = date.getFullYear();
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const d = date.getDate().toString().padStart(2, '0');
      const hh = date.getHours().toString().padStart(2, '0');
      const min = date.getMinutes().toString().padStart(2, '0');
      const timeStr = this.state.timeframe().includes('D') ? `${yyyy}-${m}-${d}` : `${m}-${d} ${hh}:${min}`;

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
