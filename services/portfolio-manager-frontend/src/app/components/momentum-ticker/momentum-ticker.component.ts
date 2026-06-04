import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-momentum-ticker',
  imports: [CommonModule],
  template: `
    @if (state.momentumStocks().length > 0) {
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold uppercase tracking-[0.2em] text-[#8696a0] font-sans">
            Weekly Momentum Leaderboard
          </span>
          <div class="flex items-center gap-1.5 md:hidden">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-ring"></span>
            <span class="text-xs text-emerald-400 font-bold uppercase tracking-wider">Live</span>
          </div>
        </div>

        <!-- Scrollable / Grid Ticker Container -->
        <div class="flex gap-4 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-slate-700/50 scrollbar-track-transparent">
          @for (item of state.momentumStocks(); track item.symbol) {
            <div
              (click)="state.selectAsset(item.symbol)"
              class="min-w-[210px] flex-1 bg-[#141d24]/90 border border-slate-800/80 rounded-xl p-4 cursor-pointer relative hover:border-[#22c55e]/50 hover:bg-[#18232c] hover:shadow-[0_8px_20px_-4px_rgba(34,197,94,0.15)] transition-all duration-300"
              title="Click to view chart"
            >
              <!-- Card Header -->
              <div class="flex justify-between items-start mb-2">
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-[#8696a0] tracking-wide">{{ item.symbol }}</span>
                  <span class="text-base font-extrabold text-white mt-1 tabular-nums">
                    \${{ item.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 3}) }}
                  </span>
                </div>
                <!-- Brand Logo (Floating Top Right) -->
                <div class="w-7 h-7 flex items-center justify-center rounded-full overflow-hidden shrink-0 shadow-inner bg-slate-900 border border-white/5 p-0.5">
                  @if (!state.logoErrors().has(item.symbol)) {
                    <img [src]="state.getLogoUrl(item.symbol)" (error)="state.onLogoError(item.symbol)" class="w-full h-full rounded-full object-contain bg-white" alt="" />
                  } @else {
                    <div class="w-full h-full flex items-center justify-center text-xs font-bold text-white rounded-full" [style.background-color]="state.getLogoColor(item.symbol)">
                      {{ item.symbol.substring(0, 2) }}
                    </div>
                  }
                </div>
              </div>

              <!-- Card Sparkline and Percentage -->
              <div class="flex items-end justify-between mt-3 gap-2">
                <!-- Percentage change -->
                <span
                  [ngClass]="item.changePct >= 0 ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/25' : 'text-rose-500 bg-rose-500/10 border-rose-500/25'"
                  class="text-xs font-bold px-2 py-0.5 rounded border flex items-center gap-1 shrink-0"
                >
                  {{ item.changePct >= 0 ? '▲' : '▼' }} {{ Math.abs(item.changePct).toFixed(2) }}%
                </span>
                
                <!-- Tiny SVG Sparkline -->
                <div class="w-20 h-8 flex items-end justify-end overflow-hidden">
                  <svg class="w-full h-full overflow-visible" viewBox="0 0 100 40">
                    <defs>
                      <linearGradient [id]="'grad_' + item.symbol" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" [attr.stop-color]="item.changePct >= 0 ? '#10b981' : '#f43f5e'" stop-opacity="0.3" />
                        <stop offset="100%" [attr.stop-color]="item.changePct >= 0 ? '#10b981' : '#f43f5e'" stop-opacity="0.0" />
                      </linearGradient>
                    </defs>
                    <!-- Sparkline Area Fill -->
                    <path
                      [attr.d]="getSparklineFill(item.symbol, item.changePct)"
                      [attr.fill]="'url(#grad_' + item.symbol + ')'"
                    />
                    <!-- Sparkline Stroke Line -->
                    <path
                      [attr.d]="getSparklinePath(item.symbol, item.changePct)"
                      fill="none"
                      [attr.stroke]="item.changePct >= 0 ? '#10b981' : '#f43f5e'"
                      stroke-width="1.8"
                      stroke-linecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MomentumTickerComponent {
  state = inject(StateService);
  Math = Math;

  // Generate a deterministic path for the sparkline based on symbol
  getSparklinePath(symbol: string, changePct: number): string {
    const points = this.getDeterministicPoints(symbol, changePct);
    let path = `M 0 ${points[0]}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${i * 14.2} ${points[i]}`;
    }
    return path;
  }

  // Generate a deterministic fill path
  getSparklineFill(symbol: string, changePct: number): string {
    const points = this.getDeterministicPoints(symbol, changePct);
    let path = `M 0 40 L 0 ${points[0]}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${i * 14.2} ${points[i]}`;
    }
    path += ` L 100 40 Z`;
    return path;
  }

  private getDeterministicPoints(symbol: string, changePct: number): number[] {
    const points: number[] = [];
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate 8 points (SVG bounds height is 40, so range 5 to 35)
    for (let i = 0; i < 8; i++) {
      let val = Math.abs((hash >> (i * 3)) % 25) + 8;
      points.push(val);
    }

    // Force endpoints to reflect the change percentage direction
    if (changePct >= 0) {
      // General upward trend
      points[0] = Math.max(points[0], 20);
      points[7] = Math.min(points[7], 12);
    } else {
      // General downward trend
      points[0] = Math.min(points[0], 12);
      points[7] = Math.max(points[7], 20);
    }

    return points;
  }
}
