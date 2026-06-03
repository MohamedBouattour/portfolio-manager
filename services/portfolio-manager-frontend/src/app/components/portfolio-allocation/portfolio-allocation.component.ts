import { Component, inject, ViewChild, ElementRef, ChangeDetectionStrategy, effect, HostListener, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-portfolio-allocation',
  imports: [CommonModule],
  template: `
    <div class="card h-full flex flex-col">
      <div class="card-header">
        <div class="flex items-center gap-2.5">
          <h3 class="text-sm font-semibold text-slate-100">&#x1F4BC; Asset Allocation</h3>
        </div>
        <div class="flex bg-slate-900/60 p-0.5 rounded-lg border border-slate-700/40">
          <button (click)="setChartMode('exposure')" class="bg-transparent border-none outline-none px-3 py-1 text-[11px] font-semibold cursor-pointer rounded-md transition-all" [ngClass]="chartMode() === 'exposure' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-300'">
            Exposure
          </button>
          <button (click)="setChartMode('margin')" class="bg-transparent border-none outline-none px-3 py-1 text-[11px] font-semibold cursor-pointer rounded-md transition-all" [ngClass]="chartMode() === 'margin' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-300'">
            Margin
          </button>
        </div>
      </div>

      <div class="p-5 flex-1 flex flex-col justify-center">
        <div class="flex items-center justify-around gap-5 flex-wrap">
          <div class="relative flex justify-center items-center" #canvasContainer>
            <canvas #chartCanvas (mousemove)="onMouseMove($event)" (mouseleave)="onMouseLeave()" class="bg-transparent block"></canvas>

            @if (tooltip) {
              <div
                class="absolute pointer-events-none bg-slate-900/95 border border-blue-500/40 shadow-lg backdrop-blur-md px-3.5 py-2.5 rounded-lg z-[100] min-w-[140px] transition-opacity duration-150"
                [style.left.px]="tooltip.x + 10"
                [style.top.px]="tooltip.y + 10"
              >
                <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ tooltip.symbol }}</div>
                <div class="text-sm font-bold text-white my-0.5">\${{ tooltip.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}</div>
                <div class="text-[11px] font-semibold text-emerald-500">{{ tooltip.percentage.toFixed(1) }}%</div>
              </div>
            }
          </div>

          <div class="flex-1 w-full max-w-[260px] min-w-[180px]">
            <div class="space-y-2 max-h-[200px] overflow-y-auto pr-1.5">
              @for (slice of slices(); track slice.symbol; let idx = $index) {
                <div
                  class="flex items-center gap-2.5 px-3 py-2 bg-slate-700/25 border border-slate-600/15 rounded-lg cursor-pointer transition-all hover:bg-blue-500/8 hover:border-blue-500/30 hover:translate-x-0.5"
                  [ngClass]="(hoveredIndex() === idx || legendHoveredIndex() === idx) ? 'bg-blue-500/8 border-blue-500/30' : ''"
                  (mouseenter)="legendHoveredIndex.set(idx)"
                  (mouseleave)="legendHoveredIndex.set(null)"
                  (click)="state.selectAsset(slice.isCash ? 'USDT' : slice.symbol)"
                >
                  <div class="w-2 h-2 rounded-full shrink-0" [style.backgroundColor]="slice.color" [style.boxShadow]="'0 0 6px ' + slice.color"></div>
                  <div class="text-[11px] text-slate-300 flex-1 truncate font-semibold">{{ slice.symbol }}</div>
                  <div class="flex flex-col items-end gap-0.5">
                    <span class="text-[11px] font-bold text-white">
                      \${{ slice.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}
                    </span>
                    <span class="text-[11px] font-semibold text-slate-400">{{ slice.percentage.toFixed(1) }}%</span>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortfolioAllocationComponent {
  state = inject(StateService);

  chartMode = signal<'exposure' | 'margin'>('exposure');
  hoveredIndex = signal<number | null>(null);
  legendHoveredIndex = signal<number | null>(null);

  tooltip: {
    symbol: string;
    value: number;
    percentage: number;
    x: number;
    y: number;
  } | null = null;

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasContainer') canvasContainer!: ElementRef<HTMLDivElement>;

  slices = computed(() => {
    const mode = this.chartMode();
    const positions = this.state.openPositions();
    const cash = Math.max(0, this.state.availableUsdt());

    const items: Array<{ symbol: string; value: number; color: string; isCash: boolean }> = [];

    items.push({
      symbol: 'USDT (Cash)',
      value: cash,
      color: '#10b981',
      isCash: true
    });

    for (const pos of positions) {
      const val = mode === 'exposure'
        ? Math.abs(pos.positionValue)
        : Math.abs(pos.positionValue) / pos.leverage;

      items.push({
        symbol: pos.symbol,
        value: val,
        color: this.state.getLogoColor(pos.symbol),
        isCash: false
      });
    }

    const total = items.reduce((sum, item) => sum + item.value, 0);

    return items.map(item => ({
      ...item,
      percentage: total > 0 ? (item.value / total) * 100 : 0
    }));
  });

  constructor() {
    effect(() => {
      this.slices();
      this.hoveredIndex();
      this.legendHoveredIndex();
      setTimeout(() => this.drawChart(), 0);
    });
  }

  setChartMode(mode: 'exposure' | 'margin') {
    this.chartMode.set(mode);
    this.hoveredIndex.set(null);
    this.tooltip = null;
  }

  @HostListener('window:resize')
  onResize() {
    this.drawChart();
  }

  onMouseMove(event: MouseEvent) {
    if (!this.chartCanvas) return;
    const canvas = this.chartCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const outerRadius = Math.min(centerX, centerY) * 0.85;
    const innerRadius = outerRadius * 0.6;

    const slicesData = this.slices();

    if (distance < innerRadius || distance > outerRadius || slicesData.length === 0) {
      this.hoveredIndex.set(null);
      this.tooltip = null;
      return;
    }

    let angle = Math.atan2(dy, dx);
    let angleFromTop = angle + Math.PI / 2;
    if (angleFromTop < 0) {
      angleFromTop += 2 * Math.PI;
    }

    let currentAngle = 0;
    let foundIndex: number | null = null;

    for (let i = 0; i < slicesData.length; i++) {
      const slice = slicesData[i];
      const angleRange = (slice.percentage / 100) * 2 * Math.PI;
      if (angleFromTop >= currentAngle && angleFromTop < currentAngle + angleRange) {
        foundIndex = i;
        break;
      }
      currentAngle += angleRange;
    }

    if (foundIndex !== null) {
      this.hoveredIndex.set(foundIndex);
      this.tooltip = {
        symbol: slicesData[foundIndex].symbol,
        value: slicesData[foundIndex].value,
        percentage: slicesData[foundIndex].percentage,
        x: x,
        y: y
      };
    } else {
      this.hoveredIndex.set(null);
      this.tooltip = null;
    }
  }

  onMouseLeave() {
    this.hoveredIndex.set(null);
    this.tooltip = null;
  }

  drawChart() {
    if (!this.chartCanvas) return;
    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 200;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const outerRadius = (size / 2) * 0.85;
    const innerRadius = outerRadius * 0.6;

    ctx.clearRect(0, 0, size, size);

    const slicesData = this.slices();
    const total = slicesData.reduce((sum, s) => sum + s.value, 0);

    if (total <= 0 || slicesData.length === 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
      ctx.arc(centerX, centerY, innerRadius, 2 * Math.PI, 0, true);
      ctx.closePath();
      ctx.fillStyle = 'rgba(71, 85, 105, 0.15)';
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#64748b';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillText('NO ASSETS', centerX, centerY - 6);
      ctx.fillText('$0.00', centerX, centerY + 8);
      return;
    }

    let startAngle = -Math.PI / 2;

    for (let i = 0; i < slicesData.length; i++) {
      const slice = slicesData[i];
      const angleRange = (slice.percentage / 100) * 2 * Math.PI;
      const endAngle = startAngle + angleRange;

      const isHovered = (i === this.hoveredIndex() || i === this.legendHoveredIndex());

      const middleAngle = startAngle + angleRange / 2;
      const shiftDist = isHovered ? 6 : 0;
      const shiftX = Math.cos(middleAngle) * shiftDist;
      const shiftY = Math.sin(middleAngle) * shiftDist;

      ctx.beginPath();
      ctx.arc(centerX + shiftX, centerY + shiftY, outerRadius, startAngle, endAngle);
      ctx.arc(centerX + shiftX, centerY + shiftY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();

      ctx.fillStyle = slice.color;
      ctx.fill();

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      startAngle = endAngle;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const mode = this.chartMode();
    ctx.fillStyle = '#64748b';
    ctx.font = '600 9px Inter, sans-serif';
    ctx.fillText(mode === 'exposure' ? 'EXPOSURE' : 'COLLATERAL', centerX, centerY - 10);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 13px Inter, sans-serif';

    const totalString = '$' + total.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    ctx.fillText(totalString, centerX, centerY + 6);
  }
}
