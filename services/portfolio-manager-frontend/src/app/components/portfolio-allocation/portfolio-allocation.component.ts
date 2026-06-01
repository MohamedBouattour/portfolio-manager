import { Component, inject, ViewChild, ElementRef, ChangeDetectionStrategy, effect, HostListener, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-portfolio-allocation',
  imports: [CommonModule],
  template: `
    <div class="card allocation-card">
      <div class="card-header">
        <div class="flex-row align-center gap-10">
          <h3>💼 Asset Allocation</h3>
        </div>
        <div class="mode-toggle-group">
          <button 
            [class.active]="chartMode() === 'exposure'" 
            (click)="setChartMode('exposure')"
            class="toggle-btn"
          >
            Exposure
          </button>
          <button 
            [class.active]="chartMode() === 'margin'" 
            (click)="setChartMode('margin')"
            class="toggle-btn"
          >
            Margin
          </button>
        </div>
      </div>
      
      <div class="card-body allocation-body">
        <div class="chart-content-row">
          <!-- Canvas Wrapper & Tooltip -->
          <div class="canvas-wrapper relative" #canvasContainer>
            <canvas 
              #chartCanvas 
              (mousemove)="onMouseMove($event)" 
              (mouseleave)="onMouseLeave()"
            ></canvas>
            
            @if (tooltip) {
              <div 
                class="chart-tooltip" 
                [style.left.px]="tooltip.x + 10" 
                [style.top.px]="tooltip.y + 10"
              >
                <div class="tooltip-symbol">{{ tooltip.symbol }}</div>
                <div class="tooltip-value">
                  \${{ tooltip.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}
                </div>
                <div class="tooltip-pct">{{ tooltip.percentage.toFixed(1) }}%</div>
              </div>
            }
          </div>

          <!-- Legend List -->
          <div class="legend-container">
            <div class="legend-list">
              @for (slice of slices(); track slice.symbol; let idx = $index) {
                <div 
                  class="legend-item" 
                  [class.hovered]="hoveredIndex() === idx || legendHoveredIndex() === idx"
                  (mouseenter)="legendHoveredIndex.set(idx)"
                  (mouseleave)="legendHoveredIndex.set(null)"
                  (click)="state.selectAsset(slice.isCash ? 'USDT' : slice.symbol)"
                >
                  <div class="legend-color-dot" [style.backgroundColor]="slice.color"></div>
                  <div class="legend-symbol bold">{{ slice.symbol }}</div>
                  <div class="legend-details text-right">
                    <span class="legend-value">
                      \${{ slice.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) }}
                    </span>
                    <span class="legend-pct">{{ slice.percentage.toFixed(1) }}%</span>
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

    // 1. Cash slice (emerald)
    items.push({
      symbol: 'USDT (Cash)',
      value: cash,
      color: '#10b981',
      isCash: true
    });

    // 2. Positions
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
    // Redraw whenever slices, mode, or hovered slices change
    effect(() => {
      // Access values to trigger reactivity
      this.slices();
      this.hoveredIndex();
      this.legendHoveredIndex();
      
      // Delay slightly to ensure canvas is rendered
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
    
    // Check if we are inside the donut ring
    if (distance < innerRadius || distance > outerRadius || slicesData.length === 0) {
      this.hoveredIndex.set(null);
      this.tooltip = null;
      return;
    }

    let angle = Math.atan2(dy, dx);
    // Normalize angle to [0, 2*PI] starting from -PI/2 (top)
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

    const size = 200; // logical square size
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
      // Draw empty portfolio placeholder donut slice (USDT cash equivalent to 0)
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
      ctx.arc(centerX, centerY, innerRadius, 2 * Math.PI, 0, true);
      ctx.closePath();
      ctx.fillStyle = 'rgba(71, 85, 105, 0.15)';
      ctx.fill();

      // Center text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#64748b';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillText('NO ASSETS', centerX, centerY - 6);
      ctx.fillText('$0.00', centerX, centerY + 8);
      return;
    }

    let startAngle = -Math.PI / 2; // start at 12 o'clock

    for (let i = 0; i < slicesData.length; i++) {
      const slice = slicesData[i];
      const angleRange = (slice.percentage / 100) * 2 * Math.PI;
      const endAngle = startAngle + angleRange;

      const isHovered = (i === this.hoveredIndex() || i === this.legendHoveredIndex());
      
      // Compute slight shift outward for the hovered slice
      const middleAngle = startAngle + angleRange / 2;
      const shiftDist = isHovered ? 6 : 0;
      const shiftX = Math.cos(middleAngle) * shiftDist;
      const shiftY = Math.sin(middleAngle) * shiftDist;

      // Draw the donut sector
      ctx.beginPath();
      // Outer arc
      ctx.arc(centerX + shiftX, centerY + shiftY, outerRadius, startAngle, endAngle);
      // Inner arc (drawn in reverse/counterclockwise)
      ctx.arc(centerX + shiftX, centerY + shiftY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();

      ctx.fillStyle = slice.color;
      ctx.fill();

      // Add a subtle border to separate segments
      ctx.strokeStyle = '#0f172a'; // slate-900 (matches dashboard cards)
      ctx.lineWidth = 1.5;
      ctx.stroke();

      startAngle = endAngle;
    }

    // Draw center summary text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const mode = this.chartMode();
    ctx.fillStyle = '#64748b'; // slate-500
    ctx.font = '600 9px Inter, sans-serif';
    ctx.fillText(mode === 'exposure' ? 'EXPOSURE' : 'COLLATERAL', centerX, centerY - 10);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 13px Inter, sans-serif';
    
    // Compact formatted currency
    const totalString = '$' + total.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    ctx.fillText(totalString, centerX, centerY + 6);
  }
}
