import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-uptrend-scouter',
  imports: [CommonModule],
  template: `
    <div class="bg-[#141d24]/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      <!-- Header -->
      <div class="px-5 py-4 border-b border-slate-800/60 flex flex-wrap justify-between items-center gap-3 bg-[#18232c]/50">
        <div class="flex items-center gap-2.5">
          <h3 class="text-sm font-extrabold text-white tracking-wide">📡 Market Scouter</h3>
          <span class="text-xs font-bold bg-[#10b981]/15 text-[#10b981] px-2.5 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wide">
            1D Daily Timeframe
          </span>
        </div>
        <span class="text-xs font-bold bg-slate-900 text-[#8696a0] border border-slate-800 px-3 py-1 rounded-full">
          Scanning {{ state.scoutingResults().length }} Assets
        </span>
      </div>

      <!-- Live indicators banner -->
      <div class="flex gap-3 p-4 bg-[#0d131a]/60 border-b border-slate-850 overflow-x-auto">
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border border-emerald-500/20 bg-emerald-500/5 shrink-0">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_#10b981]"></span>
          <span class="font-extrabold text-white font-mono">{{ state.getScoutingSummary().entry }}</span>
          <span class="text-[#8696a0] font-bold text-xs uppercase tracking-wider">Entry Signals</span>
        </div>
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border border-amber-500/20 bg-amber-500/5 shrink-0">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 shadow-[0_0_6px_#fbbf24]"></span>
          <span class="font-extrabold text-white font-mono">{{ state.getScoutingSummary().nearSignal }}</span>
          <span class="text-[#8696a0] font-bold text-xs uppercase tracking-wider">Near Signal</span>
        </div>
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border border-slate-800 bg-[#0f161c] shrink-0">
          <span class="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0"></span>
          <span class="font-extrabold text-white font-mono">{{ state.getScoutingSummary().noSignal }}</span>
          <span class="text-[#8696a0] font-bold text-xs uppercase tracking-wider">No Signal</span>
        </div>
      </div>

      <!-- Scouter Grid Table -->
      <div class="overflow-x-auto">
        @if (state.sortedScoutingResults().length > 0) {
          <table class="w-full border-collapse text-left text-xs font-sans">
            <thead>
              <tr class="bg-[#0f161c]/50 border-b border-slate-850 text-[#8696a0] font-bold">
                <th class="p-3 text-xs uppercase tracking-wider whitespace-nowrap bg-[#0d131a]/80 sticky top-0">Asset</th>
                <th class="p-3 text-xs uppercase tracking-wider whitespace-nowrap bg-[#0d131a]/80 sticky top-0 cursor-pointer hover:text-white select-none" (click)="state.toggleScoutingSort('price')">
                  Price {{ getSortIcon('price') }}
                </th>
                <th class="p-3 text-xs uppercase tracking-wider whitespace-nowrap bg-[#0d131a]/80 sticky top-0 cursor-pointer hover:text-white select-none" (click)="state.toggleScoutingSort('confidence')">
                  Confidence {{ getSortIcon('confidence') }}
                </th>
                <th class="p-3 text-xs uppercase tracking-wider whitespace-nowrap bg-[#0d131a]/80 sticky top-0">Triggered Strategies</th>
                <th class="p-3 text-xs uppercase tracking-wider whitespace-nowrap bg-[#0d131a]/80 sticky top-0 cursor-pointer hover:text-white select-none" (click)="state.toggleScoutingSort('rsi')">
                  RSI {{ getSortIcon('rsi') }}
                </th>
                <th class="p-3 text-xs uppercase tracking-wider whitespace-nowrap bg-[#0d131a]/80 sticky top-0 cursor-pointer hover:text-white select-none" (click)="state.toggleScoutingSort('histogram')">
                  MACD Hist {{ getSortIcon('histogram') }}
                </th>
                <th class="p-3 text-xs uppercase tracking-wider whitespace-nowrap bg-[#0d131a]/80 sticky top-0 cursor-pointer hover:text-white select-none" (click)="state.toggleScoutingSort('volumeRatio')">
                  Vol Ratio {{ getSortIcon('volumeRatio') }}
                </th>
                <th class="p-3 bg-[#0d131a]/80 sticky top-0"></th>
              </tr>
            </thead>
            <tbody>
              @for (item of state.sortedScoutingResults(); track item.symbol) {
                <tr
                  [ngClass]="item.shouldEnter ? 'bg-emerald-500/[0.03]' : (item.confidence ?? 0) >= 40 ? 'bg-amber-500/[0.02]' : ''"
                  (click)="state.selectAsset(item.symbol)"
                  class="cursor-pointer transition-colors border-b border-slate-850/60 hover:bg-slate-800/10"
                >
                  <td class="p-3 whitespace-nowrap">
                    <div class="flex items-center gap-2.5">
                      <div class="w-7 h-7 flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-slate-900 border border-white/5 p-0.5">
                        @if (!state.logoErrors().has(item.symbol)) {
                          <img [src]="state.getLogoUrl(item.symbol)" (error)="state.onLogoError(item.symbol)" class="w-full h-full rounded-full object-contain bg-white" alt="" />
                        } @else {
                          <div class="w-full h-full flex items-center justify-center text-xs font-bold text-white shrink-0 rounded-full" [style.backgroundColor]="state.getLogoColor(item.symbol)">
                            {{ item.symbol.substring(0, 2) }}
                          </div>
                        }
                      </div>
                      <div class="flex flex-col gap-0.5">
                        <span class="font-bold text-white text-xs">{{ item.symbol }}</span>
                        @if (item.shouldEnter) {
                          <span class="text-xs font-extrabold text-[#10b981] tracking-wider uppercase">🚀 ENTRY</span>
                        }
                      </div>
                    </div>
                  </td>

                  <td class="p-3 whitespace-nowrap font-bold text-slate-200 font-mono tabular-nums">\${{ item.price.toFixed(2) }}</td>

                  <td class="p-3 whitespace-nowrap">
                    <div class="flex items-center gap-2 min-w-[110px]">
                      <div class="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden min-w-[50px]">
                        <div
                          class="h-full rounded-full transition-all duration-300"
                          [class.bg-slate-400]="(item.confidence ?? 0) < 40"
                          [class.bg-amber-500]="(item.confidence ?? 0) >= 40 && (item.confidence ?? 0) < 70"
                          [class.bg-emerald-500]="(item.confidence ?? 0) >= 70"
                          [style.width.%]="item.confidence ?? 0"
                        ></div>
                      </div>
                      <span class="text-xs font-bold text-slate-400 min-w-[28px] text-right font-mono tabular-nums">{{ item.confidence ?? 0 }}%</span>
                    </div>
                  </td>

                  <td class="p-3 whitespace-nowrap">
                    <div class="flex gap-1 flex-wrap">
                      @if (item.triggeredStrategies && item.triggeredStrategies.length > 0) {
                        @for (strat of item.triggeredStrategies; track strat) {
                          <span
                            [ngClass]="strat === 'MACD' ? 'bg-[#0ea5e9]/10 text-[#0ea5e9] border-[#0ea5e9]/20' : strat === 'RSI' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'"
                            class="text-xs font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider"
                          >{{ strat }}</span>
                        }
                      } @else {
                        <span class="text-xs text-slate-400 font-bold">&mdash;</span>
                      }
                    </div>
                  </td>

                  <td class="p-3 whitespace-nowrap font-mono tabular-nums">
                    @let rsi = item.rsi ?? 0;
                    <span
                      [ngClass]="rsi > 0 && rsi < 30 ? 'text-rose-500 font-bold' : rsi > 70 ? 'text-emerald-400 font-bold' : 'text-slate-400 font-semibold'"
                    >
                      {{ rsi > 0 ? rsi.toFixed(1) : '&mdash;' }}
                    </span>
                  </td>

                  <td class="p-3 whitespace-nowrap font-mono tabular-nums">
                    @let hist = item.histogram;
                    <span [class.text-emerald-500]="(hist ?? 0) > 0" [class.text-rose-500]="(hist ?? 0) < 0" class="font-semibold">
                      {{ hist !== undefined ? hist.toFixed(4) : '&mdash;' }}
                    </span>
                  </td>

                  <td class="p-3 whitespace-nowrap font-mono tabular-nums">
                    @let vol = item.volumeRatio ?? 0;
                    <span [ngClass]="vol >= 2 ? 'text-amber-400 font-extrabold' : vol >= 1.5 ? 'text-amber-600 font-bold' : 'text-slate-400 font-semibold'">
                      {{ vol > 0 ? vol.toFixed(1) + 'x' : '&mdash;' }}
                    </span>
                  </td>

                  <td class="p-3 whitespace-nowrap text-right">
                    <button 
                      (click)="onViewChart($event, item.symbol)"
                      class="px-2.5 py-1 text-xs font-bold rounded-lg border border-sky-500/30 text-sky-400 hover:bg-sky-500 hover:text-slate-950 transition-all cursor-pointer whitespace-nowrap"
                    >
                      View Chart &rarr;
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <div class="flex flex-col items-center justify-center py-16 text-center text-slate-400 bg-[#0f161c]/10">
            <span class="text-3xl mb-2.5">📡</span>
            <p class="text-xs font-bold">Scouting markets... Waiting for Daily timeframe updates.</p>
          </div>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UptrendScouterComponent {
  state = inject(StateService);

  onViewChart(event: Event, symbol: string) {
    event.stopPropagation();
    this.state.selectAsset(symbol);
    const chartEl = document.querySelector('app-historical-chart');
    if (chartEl) {
      chartEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  getSortIcon(field: string): string {
    if (this.state.scoutingSortField() !== field) return '\u21D5';
    return this.state.scoutingSortDir() === 'desc' ? '\u2193' : '\u2191';
  }
}
