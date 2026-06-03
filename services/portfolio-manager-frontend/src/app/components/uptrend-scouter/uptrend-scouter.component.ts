import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-uptrend-scouter',
  imports: [CommonModule],
  template: `
    <div class="card border-blue-500/20 shadow-[0_8px_32px_0_rgba(59,130,246,0.05)]">
      <div class="card-header flex-wrap gap-2">
        <div class="flex items-center gap-2.5">
          <h3 class="text-sm font-semibold text-slate-100">&#x1F4E1; Market Scouter</h3>
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Timeframe:</span>
            <span class="px-2.5 py-1 rounded-full text-xs font-semibold border bg-blue-500/10 text-blue-400 border-blue-500/20">1D (Daily)</span>
          </div>
        </div>
        <div class="flex items-center gap-2.5">
          <span class="text-[11px] font-semibold bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full border border-blue-500/20">
            Scanning {{ state.scoutingResults().length }} Assets
          </span>
        </div>
      </div>

      <div class="flex gap-3 p-3.5 bg-slate-900/50 border-b border-slate-700/30 overflow-x-auto">
        <div class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs border border-slate-700/30 bg-slate-700/30 shrink-0" style="border-color: rgba(16,185,129,0.25)">
          <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0" style="box-shadow: 0 0 8px rgba(16,185,129,0.6)"></span>
          <span class="font-bold text-sm text-slate-100">{{ state.getScoutingSummary().entry }}</span>
          <span class="text-slate-400 font-medium">Entry Signals</span>
        </div>
        <div class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs border border-slate-700/30 bg-slate-700/30 shrink-0" style="border-color: rgba(251,191,36,0.2)">
          <span class="w-2 h-2 rounded-full bg-amber-400 shrink-0" style="box-shadow: 0 0 6px rgba(251,191,36,0.4)"></span>
          <span class="font-bold text-sm text-slate-100">{{ state.getScoutingSummary().nearSignal }}</span>
          <span class="text-slate-400 font-medium">Near Signal</span>
        </div>
        <div class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs border border-slate-700/30 bg-slate-700/30 shrink-0">
          <span class="w-2 h-2 rounded-full bg-slate-500 shrink-0"></span>
          <span class="font-bold text-sm text-slate-100">{{ state.getScoutingSummary().noSignal }}</span>
          <span class="text-slate-400 font-medium">No Signal</span>
        </div>
      </div>

      <div class="overflow-x-auto">
        @if (state.sortedScoutingResults().length > 0) {
          <table class="w-full border-collapse text-left text-xs">
            <thead>
              <tr>
                <th class="p-3 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 bg-slate-900/80 sticky top-0 z-10 whitespace-nowrap">Asset</th>
                <th class="p-3 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 bg-slate-900/80 sticky top-0 z-10 whitespace-nowrap cursor-pointer hover:text-blue-400 select-none" (click)="state.toggleScoutingSort('price')">
                  Price <span class="text-xs opacity-75">{{ getSortIcon('price') }}</span>
                </th>
                <th class="p-3 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 bg-slate-900/80 sticky top-0 z-10 whitespace-nowrap cursor-pointer hover:text-blue-400 select-none" (click)="state.toggleScoutingSort('confidence')">
                  Confidence <span class="text-xs opacity-75">{{ getSortIcon('confidence') }}</span>
                </th>
                <th class="p-3 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 bg-slate-900/80 sticky top-0 z-10 whitespace-nowrap">Strategies</th>
                <th class="p-3 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 bg-slate-900/80 sticky top-0 z-10 whitespace-nowrap cursor-pointer hover:text-blue-400 select-none" (click)="state.toggleScoutingSort('rsi')">
                  RSI <span class="text-xs opacity-75">{{ getSortIcon('rsi') }}</span>
                </th>
                <th class="p-3 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 bg-slate-900/80 sticky top-0 z-10 whitespace-nowrap cursor-pointer hover:text-blue-400 select-none" (click)="state.toggleScoutingSort('histogram')">
                  MACD Hist <span class="text-xs opacity-75">{{ getSortIcon('histogram') }}</span>
                </th>
                <th class="p-3 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 bg-slate-900/80 sticky top-0 z-10 whitespace-nowrap cursor-pointer hover:text-blue-400 select-none" (click)="state.toggleScoutingSort('volumeRatio')">
                  Vol Ratio <span class="text-xs opacity-75">{{ getSortIcon('volumeRatio') }}</span>
                </th>
                <th class="p-3"></th>
              </tr>
            </thead>
            <tbody>
              @for (item of state.sortedScoutingResults(); track item.symbol) {
                <tr
                  class="cursor-pointer transition-colors hover:bg-slate-700/15"
                  [ngClass]="item.shouldEnter ? 'bg-emerald-500/[0.04]' : (item.confidence ?? 0) >= 40 ? 'bg-amber-500/[0.03]' : ''"
                  (click)="state.selectedAsset.set(item.symbol)"
                >
                  <td class="p-3 border-b border-slate-700/15 whitespace-nowrap">
                    <div class="flex items-center gap-2.5">
                      @if (!state.logoErrors().has(item.symbol)) {
                        <img [src]="state.getLogoUrl(item.symbol)" (error)="state.onLogoError(item.symbol)" class="w-7 h-7 rounded-full object-contain bg-slate-700 border border-white/5 shrink-0" alt="" />
                      } @else {
                        <div class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" [style.backgroundColor]="state.getLogoColor(item.symbol)">
                          {{ item.symbol.substring(0, 2) }}
                        </div>
                      }
                      <div class="flex flex-col gap-0.5">
                        <span class="font-semibold text-slate-100 text-xs">{{ item.symbol }}</span>
                        @if (item.shouldEnter) {
                          <span class="text-[11px] font-bold text-emerald-500">&#x1F680; ENTRY</span>
                        }
                      </div>
                    </div>
                  </td>

                  <td class="p-3 border-b border-slate-700/15 whitespace-nowrap font-semibold text-slate-200 tabular-nums">\${{ item.price.toFixed(2) }}</td>

                  <td class="p-3 border-b border-slate-700/15 whitespace-nowrap">
                    <div class="flex items-center gap-2 min-w-[120px]">
                      <div class="flex-1 h-1.5 bg-slate-700/40 rounded-full overflow-hidden min-w-[60px]">
                        <div
                          class="h-full rounded-full transition-all duration-300"
                          [class.bg-gradient-to-r.from-slate-500.to-slate-400]="(item.confidence ?? 0) < 40"
                          [class.bg-gradient-to-r.from-amber-600.to-amber-400]="(item.confidence ?? 0) >= 40 && (item.confidence ?? 0) < 70"
                          [class.bg-gradient-to-r.from-emerald-600.to-emerald-500]="(item.confidence ?? 0) >= 70"
                          [style.width.%]="item.confidence ?? 0"
                        ></div>
                      </div>
                      <span class="text-[11px] font-bold text-slate-400 min-w-[32px] text-right tabular-nums">{{ item.confidence ?? 0 }}%</span>
                    </div>
                  </td>

                  <td class="p-3 border-b border-slate-700/15 whitespace-nowrap">
                    <div class="flex gap-1 flex-wrap">
                      @if (item.triggeredStrategies && item.triggeredStrategies.length > 0) {
                        @for (strat of item.triggeredStrategies; track strat) {
                          <span
                            class="text-[11px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                            [ngClass]="strat === 'MACD' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : strat === 'RSI' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'"
                          >{{ strat }}</span>
                        }
                      } @else {
                        <span class="text-[11px] text-slate-400">&mdash;</span>
                      }
                    </div>
                  </td>

                  <td class="p-3 border-b border-slate-700/15 whitespace-nowrap">
                    @let rsi = item.rsi ?? 0;
                    <span
                      [ngClass]="rsi > 0 && rsi < 30 ? 'text-rose-500 font-bold' : rsi > 70 ? 'text-emerald-500 font-semibold' : 'text-slate-400'"
                    >
                      {{ rsi > 0 ? rsi.toFixed(1) : '&mdash;' }}
                    </span>
                  </td>

                  <td class="p-3 border-b border-slate-700/15 whitespace-nowrap">
                    @let hist = item.histogram;
                    <span [class.text-emerald-500]="(hist ?? 0) > 0" [class.text-rose-400]="(hist ?? 0) < 0">
                      {{ hist !== undefined ? hist.toFixed(4) : '&mdash;' }}
                    </span>
                  </td>

                  <td class="p-3 border-b border-slate-700/15 whitespace-nowrap">
                    @let vol = item.volumeRatio ?? 0;
                    <span [ngClass]="vol >= 2 ? 'text-amber-400 font-bold' : vol >= 1.5 ? 'text-amber-600 font-semibold' : ''">
                      {{ vol > 0 ? vol.toFixed(1) + 'x' : '&mdash;' }}
                    </span>
                  </td>

                  <td class="p-3 border-b border-slate-700/15 whitespace-nowrap">
                    <button class="text-[11px] font-semibold px-2 py-1 rounded-md bg-transparent border border-blue-500/30 text-blue-400 hover:bg-blue-500 hover:text-white hover:-translate-y-0.5 transition-all whitespace-nowrap" (click)="onViewChart($event, item.symbol)">
                      View Chart &#x2192;
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <div class="flex flex-col items-center justify-center py-10 text-center text-slate-400">
            <span class="text-3xl mb-2.5">&#x1F4E1;</span>
            <p class="text-xs">Scouting in progress... Waiting for market data to evaluate strategies.</p>
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
    this.state.selectedAsset.set(symbol);
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
