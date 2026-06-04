import { Component, inject, ViewChild, ElementRef, ChangeDetectionStrategy, effect, HostListener, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-portfolio-allocation',
  imports: [CommonModule],
  template: `
    <div class="bg-[#141d24]/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full">
      <!-- Header -->
      <div class="px-5 py-4 border-b border-slate-800/60 flex justify-between items-center bg-[#18232c]/50">
        <h3 class="text-sm font-extrabold text-white tracking-wide">📊 Asset Allocation</h3>
        
        <!-- Toggle button group -->
        <div class="flex bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
          <button 
            (click)="setChartMode('exposure')" 
            class="px-2.5 py-1 text-xs font-bold cursor-pointer rounded-md transition-all border-none outline-none" 
            [ngClass]="chartMode() === 'exposure' ? 'bg-[#18232c] text-emerald-400' : 'text-[#8696a0] hover:text-white'"
          >
            Exposure
          </button>
          <button 
            (click)="setChartMode('margin')" 
            class="px-2.5 py-1 text-xs font-bold cursor-pointer rounded-md transition-all border-none outline-none" 
            [ngClass]="chartMode() === 'margin' ? 'bg-[#18232c] text-emerald-400' : 'text-[#8696a0] hover:text-white'"
          >
            Margin
          </button>
        </div>
      </div>

      <!-- Donut Chart & Legend -->
      <div class="p-5 flex-1 flex flex-col justify-center bg-[#0d131a]/40">
        <div class="flex flex-col sm:flex-row items-center justify-around gap-6">
          
          <!-- Donut Canvas Container -->
          <div class="relative flex justify-center items-center shrink-0" #canvasContainer>
            <canvas #chartCanvas (mousemove)="onMouseMove($event)" (mouseleave)="onMouseLeave()" class="bg-transparent block cursor-pointer"></canvas>

            <!-- Tooltip -->
            @if (tooltip) {
              <div
                class="absolute pointer-events-none bg-[#0f161c]/95 border border-emerald-500/30 shadow-2xl backdrop-blur-md px-3 py-2 rounded-xl z-[100] min-w-[130px] transition-opacity duration-150 text-left animate-fade-in"
                [style.left.px]="tooltip.x + 10"
                [style.top.px]="tooltip.y + 10"
              >
                <div class="text-xs font-extrabold uppercase tracking-wider text-slate-400">{{ tooltip.symbol }}</div>
                <div class="text-xs font-extrabold text-white my-0.5 font-mono">\${{ tooltip.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}</div>
                <div class="text-xs font-bold text-emerald-400 font-mono">{{ tooltip.percentage.toFixed(1) }}%</div>
              </div>
            }
          </div>

          <!-- Legend list -->
          <div class="flex-1 w-full max-w-[240px]">
            <div class="space-y-2 max-h-[170px] overflow-y-auto pr-1.5 custom-scrollbar">
              @for (slice of slices(); track slice.symbol; let idx = $index) {
                <div
                  (click)="state.selectAsset(slice.isCash ? 'USDT' : slice.symbol)"
                  (mouseenter)="legendHoveredIndex.set(idx)"
                  (mouseleave)="legendHoveredIndex.set(null)"
                  [ngClass]="(hoveredIndex() === idx || legendHoveredIndex() === idx) ? 'bg-[#18232c]/80 border-slate-700' : 'bg-[#0f161c]/40 border-slate-850'"
                  class="flex items-center gap-2.5 px-3 py-2 border rounded-xl cursor-pointer transition-all duration-200"
                >
                  <div class="w-2 h-2 rounded-full shrink-0 shadow-lg" [style.backgroundColor]="slice.color" [style.boxShadow]="'0 0 6px ' + slice.color"></div>
                  <div class="text-xs text-slate-300 flex-1 truncate font-bold">{{ slice.symbol }}</div>
                  
                  <div class="flex flex-col items-end gap-0.5 text-right font-mono text-xs">
                    <span class="font-extrabold text-white">
                      \${{ slice.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}
                    </span>
                    <span class="font-bold text-slate-400">{{ slice.percentage.toFixed(1) }}%</span>
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

    const size = 160;
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
      ctx.fillStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#8696a0';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('NO ASSETS', centerX, centerY - 6);
      ctx.fillText('$0.00', centerX, centerY + 6);
      return;
    }

    let startAngle = -Math.PI / 2;

    for (let i = 0; i < slicesData.length; i++) {
      const slice = slicesData[i];
      const angleRange = (slice.percentage / 100) * 2 * Math.PI;
      const endAngle = startAngle + angleRange;

      const isHovered = (i === this.hoveredIndex() || i === this.legendHoveredIndex());

      const middleAngle = startAngle + angleRange / 2;
      const shiftDist = isHovered ? 4 : 0;
      const shiftX = Math.cos(middleAngle) * shiftDist;
      const shiftY = Math.sin(middleAngle) * shiftDist;

      ctx.beginPath();
      ctx.arc(centerX + shiftX, centerY + shiftY, outerRadius, startAngle, endAngle);
      ctx.arc(centerX + shiftX, centerY + shiftY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();

      ctx.fillStyle = slice.color;
      ctx.fill();

      ctx.strokeStyle = '#0d131a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      startAngle = endAngle;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const mode = this.chartMode();
    ctx.fillStyle = '#8696a0';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(mode === 'exposure' ? 'EXPOSURE' : 'COLLATERAL', centerX, centerY - 10);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'extrabold 12px monospace';

    const totalString = '$' + total.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    ctx.fillText(totalString, centerX, centerY + 6);
  }
}
