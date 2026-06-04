import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-summary-cards',
  imports: [CommonModule],
  template: `
    <div class="w-full">
      @if (state.bybitBalance()) {
        <!-- Summary Cards Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 animate-fade-in">
          
          <!-- Card 1: Initial Balance -->
          <div class="flex flex-col bg-[#141d24]/95 border border-slate-800/90 hover:border-slate-700/60 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-6px_rgba(245,158,11,0.15)] p-4 rounded-2xl transition-all duration-300 relative overflow-hidden group">
            <div class="flex justify-between items-center mb-2.5">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-300 group-hover:text-slate-200 transition-colors">Initial Balance</span>
              <div class="w-7 h-7 rounded-xl bg-[#0d131a] border border-slate-800/80 flex items-center justify-center text-xs group-hover:bg-slate-800 transition-colors shadow-inner">💰</div>
            </div>
            <div class="flex items-baseline gap-1 mt-1">
              <span class="text-lg font-black text-white tabular-nums select-all tracking-wide">\${{ state.botBalance().toFixed(2) }}</span>
            </div>
          </div>

          <!-- Card 2: Current Equity -->
          <div class="flex flex-col bg-[#141d24]/95 border border-slate-800/90 hover:border-slate-700/60 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-6px_rgba(14,165,233,0.15)] p-4 rounded-2xl transition-all duration-300 relative overflow-hidden group">
            <div class="flex justify-between items-center mb-2.5">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-300 group-hover:text-slate-200 transition-colors">Current Equity</span>
              <div class="w-7 h-7 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:bg-sky-500 group-hover:text-[#0b0f14] transition-all duration-300 shadow-sm">
                <!-- Equity line chart SVG -->
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div class="flex items-baseline gap-1 mt-1">
              <span class="text-lg font-black text-white tabular-nums select-all tracking-wide">\${{ state.equity().toFixed(2) }}</span>
            </div>
          </div>

          <!-- Card 3: Available USDT -->
          <div class="flex flex-col bg-[#141d24]/95 border border-slate-800/90 hover:border-slate-700/60 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-6px_rgba(20,184,166,0.15)] p-4 rounded-2xl transition-all duration-300 relative overflow-hidden group">
            <div class="flex justify-between items-center mb-2.5">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-300 group-hover:text-slate-200 transition-colors">Available USDT</span>
              <div class="w-7 h-7 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 group-hover:bg-teal-500 group-hover:text-[#0b0f14] transition-all duration-300 shadow-sm">
                <!-- Coin / Token SVG -->
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="9" />
                  <path stroke-linecap="round" d="M9 8h6M12 8v8M10 12h4" />
                </svg>
              </div>
            </div>
            <div class="flex items-baseline gap-1 mt-1">
              <span class="text-lg font-black text-teal-300 tabular-nums select-all tracking-wide">\${{ state.availableUsdt().toFixed(2) }}</span>
            </div>
          </div>

          <!-- Card 4: Margin Locked -->
          <div class="flex flex-col bg-[#141d24]/95 border border-slate-800/90 hover:border-slate-700/60 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-6px_rgba(244,63,94,0.15)] p-4 rounded-2xl transition-all duration-300 relative overflow-hidden group">
            <div class="flex justify-between items-center mb-2.5">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-300 group-hover:text-slate-200 transition-colors">Margin Locked</span>
              <div class="w-7 h-7 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:bg-rose-500 group-hover:text-slate-950 transition-all duration-300 shadow-sm">
                <!-- Shield / Lock SVG -->
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <div class="flex items-baseline gap-1 mt-1">
              <span class="text-lg font-black text-slate-200 tabular-nums select-all tracking-wide">\${{ state.positionMargin().toFixed(2) }}</span>
            </div>
          </div>

          <!-- Card 5: Floating PnL -->
          <div 
            [class.border-l-emerald-500]="state.totalFloatingPnl() >= 0" 
            [class.border-l-rose-500]="state.totalFloatingPnl() < 0"
            class="flex flex-col bg-[#141d24]/95 border border-l-4 border-slate-800/90 hover:border-slate-700/60 hover:-translate-y-0.5 p-4 rounded-2xl transition-all duration-300 relative overflow-hidden group"
            [ngClass]="state.totalFloatingPnl() >= 0 ? 'hover:shadow-[0_8px_20px_-6px_rgba(16,185,129,0.15)]' : 'hover:shadow-[0_8px_20px_-6px_rgba(244,63,94,0.15)]'"
          >
            <div class="flex justify-between items-center mb-2.5">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-300 group-hover:text-slate-200 transition-colors">Floating PnL</span>
              <div 
                [ngClass]="state.totalFloatingPnl() >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-[#0b0f14]' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 group-hover:bg-rose-500 group-hover:text-[#0b0f14]'"
                class="w-7 h-7 rounded-xl border flex items-center justify-center text-xs transition-all duration-300 shadow-sm"
              >
                <!-- Scale / Balance SVG -->
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7h12m0 0l-3-1m3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-9-6v9m-3 0h6" />
                </svg>
              </div>
            </div>
            <div class="flex items-center gap-1.5 mt-1">
              <span 
                [class.text-emerald-400]="state.totalFloatingPnl() >= 0" 
                [class.text-rose-500]="state.totalFloatingPnl() < 0"
                class="text-lg font-black tabular-nums select-all tracking-wide"
              >
                {{ state.totalFloatingPnl() >= 0 ? '+' : '' }}\${{ state.totalFloatingPnl().toFixed(2) }}
              </span>
              <span 
                [class.text-emerald-400]="state.totalFloatingPnl() >= 0" 
                [class.text-rose-500]="state.totalFloatingPnl() < 0"
                class="text-xs font-bold"
              >
                {{ state.totalFloatingPnl() >= 0 ? '▲' : '▼' }}
              </span>
            </div>
          </div>

          <!-- Card 6: Portfolio ROI -->
          <div 
            [class.border-l-emerald-500]="state.roiFromInitial() >= 0" 
            [class.border-l-rose-500]="state.roiFromInitial() < 0"
            class="flex flex-col bg-[#141d24]/95 border border-l-4 border-slate-800/90 hover:border-slate-700/60 hover:-translate-y-0.5 p-4 rounded-2xl transition-all duration-300 relative overflow-hidden group"
            [ngClass]="state.roiFromInitial() >= 0 ? 'hover:shadow-[0_8px_20px_-6px_rgba(16,185,129,0.15)]' : 'hover:shadow-[0_8px_20px_-6px_rgba(244,63,94,0.15)]'"
          >
            <div class="flex justify-between items-center mb-2.5">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-300 group-hover:text-slate-200 transition-colors">Portfolio ROI</span>
              <div 
                [ngClass]="state.roiFromInitial() >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-[#0b0f14]' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 group-hover:bg-rose-500 group-hover:text-[#0b0f14]'"
                class="w-7 h-7 rounded-xl border flex items-center justify-center text-xs transition-all duration-300 shadow-sm"
              >
                <!-- Rocket SVG -->
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div class="flex items-center gap-1.5 mt-1">
              <span 
                [class.text-emerald-400]="state.roiFromInitial() >= 0" 
                [class.text-rose-500]="state.roiFromInitial() < 0"
                class="text-lg font-black tabular-nums select-all tracking-wide"
              >
                {{ state.roiFromInitial() >= 0 ? '+' : '' }}{{ state.roiFromInitial().toFixed(2) }}%
              </span>
              <span 
                [class.text-emerald-400]="state.roiFromInitial() >= 0" 
                [class.text-rose-500]="state.roiFromInitial() < 0"
                class="text-xs font-bold"
              >
                {{ state.roiFromInitial() >= 0 ? '▲' : '▼' }}
              </span>
            </div>
          </div>

        </div>
      } @else {
        <!-- Shimmering Skeleton Loader -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          @for (card of [1, 2, 3, 4, 5, 6]; track card) {
            <div class="flex flex-col bg-[#141d24]/50 border border-slate-800/80 p-4 rounded-2xl gap-2.5 h-[84px] shadow-sm relative overflow-hidden">
              <div class="flex justify-between items-center">
                <div class="h-2.5 w-16 rounded skeleton-shimmer opacity-40"></div>
                <div class="h-6 w-6 rounded-lg bg-slate-900/60 border border-slate-800/80 skeleton-shimmer opacity-20"></div>
              </div>
              <div class="h-4.5 w-24 rounded skeleton-shimmer mt-1.5 opacity-60"></div>
            </div>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SummaryCardsComponent {
  state = inject(StateService);
}
