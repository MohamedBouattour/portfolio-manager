import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-momentum-ticker',
  imports: [CommonModule],
  template: `
    @if (state.momentumStocks().length > 0) {
      <div class="flex items-center bg-slate-800/60 backdrop-blur-xl border border-slate-700/40 rounded-xl overflow-hidden h-12 shadow-lg max-w-7xl mx-auto my-4 sm:my-6 px-3 sm:px-4 lg:px-6">
        <div class="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-rose-700 h-full px-3 sm:px-4 shrink-0 shadow-md z-10">
          <span class="w-2 h-2 bg-white rounded-full shadow-[0_0_8px_white] animate-pulse-ring"></span>
          <span class="text-xs font-extrabold tracking-wider text-white whitespace-nowrap">WEEKLY MOMENTUM</span>
        </div>
        <div class="flex-1 overflow-hidden flex items-center relative">
          <div class="flex items-center gap-8 whitespace-nowrap animate-ticker-scroll pl-4 hover:[animation-play-state:paused]">
            @for (item of state.momentumStocks(); track item.symbol) {
              <div class="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-700/40 border border-slate-600/20 cursor-pointer transition-all duration-200 hover:bg-blue-500/15 hover:border-blue-500/30 hover:-translate-y-0.5" (click)="state.selectAsset(item.symbol)" title="Click to view chart">
                <div class="w-5 h-5 flex items-center justify-center rounded-full overflow-hidden shrink-0">
                  @if (!state.logoErrors().has(item.symbol)) {
                    <img [src]="state.getLogoUrl(item.symbol)" (error)="state.onLogoError(item.symbol)" class="w-full h-full rounded-full bg-white object-contain p-0.5" alt="" />
                  } @else {
                    <div class="w-full h-full flex items-center justify-center text-[10px] font-bold text-white" [style.background-color]="state.getLogoColor(item.symbol)">
                      {{ item.symbol.substring(0, 2) }}
                    </div>
                  }
                </div>
                <span class="text-xs font-bold text-slate-300">{{ item.symbol }}</span>
                <span class="text-xs font-medium text-slate-400">\${{ item.price.toFixed(2) }}</span>
                <span class="text-xs font-bold text-emerald-500">+{{ item.changePct.toFixed(1) }}%</span>
              </div>
            }
            @for (item of state.momentumStocks(); track 'dup_' + item.symbol) {
              <div class="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-700/40 border border-slate-600/20 cursor-pointer transition-all duration-200 hover:bg-blue-500/15 hover:border-blue-500/30 hover:-translate-y-0.5" (click)="state.selectAsset(item.symbol)" title="Click to view chart">
                <div class="w-5 h-5 flex items-center justify-center rounded-full overflow-hidden shrink-0">
                  @if (!state.logoErrors().has(item.symbol)) {
                    <img [src]="state.getLogoUrl(item.symbol)" (error)="state.onLogoError(item.symbol)" class="w-full h-full rounded-full bg-white object-contain p-0.5" alt="" />
                  } @else {
                    <div class="w-full h-full flex items-center justify-center text-[10px] font-bold text-white" [style.background-color]="state.getLogoColor(item.symbol)">
                      {{ item.symbol.substring(0, 2) }}
                    </div>
                  }
                </div>
                <span class="text-xs font-bold text-slate-300">{{ item.symbol }}</span>
                <span class="text-xs font-medium text-slate-400">\${{ item.price.toFixed(2) }}</span>
                <span class="text-xs font-bold text-emerald-500">+{{ item.changePct.toFixed(1) }}%</span>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MomentumTickerComponent {
  state = inject(StateService);
}
