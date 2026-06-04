import { Component, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-positions-table',
  imports: [CommonModule],
  template: `
    <div class="bg-[#141d24]/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      <!-- Card Header -->
      <div class="px-5 py-4 border-b border-slate-800/60 flex flex-wrap justify-between items-center gap-3 bg-[#18232c]/50">
        <div class="flex items-center gap-2.5">
          <h3 class="text-sm font-extrabold text-white tracking-wide">💼 Live Bybit Positions</h3>
          <span
            [ngClass]="state.manualMode() ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'"
            class="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full border tracking-wider"
          >
            {{ state.manualMode() ? '🔴 Manual Guard Active' : '🟢 Auto Execution' }}
          </span>
        </div>
        <button 
          (click)="state.fetchOpenPositions(); state.fetchWalletBalance()" 
          class="px-3 py-1.5 bg-[#0f161c] hover:bg-slate-800 text-[#8696a0] hover:text-white border border-slate-800 text-xs font-bold rounded-lg cursor-pointer transition-all"
        >
          🔄 Refresh
        </button>
      </div>

      <div class="p-5 space-y-5 bg-[#0d131a]/40">
        @if (state.bybitBalance()) {
          <!-- Active config badges -->
          <div class="flex flex-wrap gap-2 p-2 bg-[#0d131a] rounded-xl border border-slate-850 font-mono text-xs text-[#8696a0]">
            <span class="bg-[#141d24] px-2.5 py-1 rounded-md border border-slate-800">Timeframe: <strong class="text-white">{{ state.timeframe() }}</strong></span>
            <span class="bg-[#141d24] px-2.5 py-1 rounded-md border border-slate-800">Leverage: <strong class="text-white">{{ state.botLeverage() }}x</strong></span>
            <span class="bg-[#141d24] px-2.5 py-1 rounded-md border border-slate-800">Max Alloc: <strong class="text-white">{{ state.maxAllocPct() }}%</strong></span>
            <span class="bg-[#141d24] px-2.5 py-1 rounded-md border border-slate-800">TP: <strong class="text-[#10b981]">+{{ state.profitThresholdPct() }}%</strong></span>
            <span class="bg-[#141d24] px-2.5 py-1 rounded-md border border-slate-800">SL/DCA: <strong class="text-rose-400">-{{ state.rebuyThresholdPct() }}%</strong></span>
          </div>

          <!-- Positions Table -->
          @if (state.openPositions().length > 0) {
            <div class="overflow-x-auto border border-slate-850 rounded-xl bg-[#0f161c]/20">
              <table class="w-full border-collapse text-left text-xs font-sans">
                <thead>
                  <tr class="bg-[#0f161c]/70 border-b border-slate-850 text-slate-300 font-bold">
                    <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Asset</th>
                    <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Size</th>
                    <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Entry &#x2192; Mark</th>
                    <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">PnL</th>
                    <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Allocation</th>
                    <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Last Action</th>
                    <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap text-right">Execute</th>
                  </tr>
                </thead>
                <tbody>
                  @for (pos of sortedPositions(); track pos.symbol) {
                    @let decision = state.getPositionDecision(pos);
                    @let pnlPct = state.getPnlPercent(pos);
                    @let weight = getPositionWeight(pos);
                    @let isDca = decision.action === 'DCA_REBUY';
                    @let isTp = decision.action === 'REDUCE';
                    
                    <tr
                      (click)="state.selectAsset(pos.symbol)"
                      [ngClass]="isTp ? 'bg-emerald-500/[0.04]' : isDca ? 'bg-blue-500/[0.04]' : 'hover:bg-slate-800/10'"
                      class="cursor-pointer transition-colors border-b border-slate-850/60"
                    >
                      <td class="p-3 whitespace-nowrap">
                        <div class="flex items-center gap-2">
                          <span class="font-extrabold text-white text-xs">{{ pos.symbol }}</span>
                          <span
                            [ngClass]="pos.side === 'Buy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/25'"
                            class="text-xs font-extrabold px-1.5 py-0.5 rounded border"
                          >
                            {{ pos.side === 'Buy' ? 'LONG' : 'SHORT' }}
                          </span>
                          
                          <!-- Dynamic Automation Status Beacon with Hover Tooltip -->
                          <div class="relative group flex items-center cursor-help" (click)="$event.stopPropagation()">
                            @if (isTp) {
                              <span class="text-xs font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_6px_rgba(52,211,153,0.2)] animate-pulse">SELL</span>
                            } @else if (isDca) {
                              <span class="text-xs font-extrabold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-[0_0_6px_rgba(56,189,248,0.2)] animate-pulse">BUY</span>
                            } @else {
                              <span class="text-xs font-extrabold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_6px_rgba(245,158,11,0.15)]">HOLD</span>
                            }
                            
                            <!-- Premium Left-Aligned Tooltip (prevents screen edge overflow) -->
                            <div class="absolute bottom-full left-0 mb-2 w-72 p-3 bg-slate-950/95 border border-slate-800 text-slate-200 text-xs rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none text-left whitespace-normal break-words">
                              <div class="flex items-center gap-1.5 mb-1.5">
                                <span 
                                  [ngClass]="isTp ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : isDca ? 'text-sky-400 bg-sky-500/10 border-sky-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'"
                                  class="font-extrabold uppercase text-xs px-2 py-0.5 rounded border tracking-wider"
                                >
                                  {{ isTp ? '🟢 Take Profit Active' : isDca ? '🔵 DCA Rebuy Active' : '🟡 Bot Holding' }}
                                </span>
                              </div>
                              <p class="leading-relaxed text-xs font-medium text-slate-300">{{ decision.reason }}</p>
                              <!-- Tooltip Arrow aligned with trigger badge -->
                              <div class="absolute top-full left-[14px] -mt-1 border-4 border-transparent border-t-slate-950"></div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td class="p-3 whitespace-nowrap">
                        <span class="font-bold text-slate-200">{{ pos.size }}</span>
                      </td>
                      <td class="p-3 whitespace-nowrap">
                        <div class="flex items-center gap-1.5 font-mono text-xs tabular-nums">
                          <span class="text-slate-400">\${{ pos.avgPrice.toFixed(2) }}</span>
                          <span [class.text-emerald-400]="pos.markPrice >= pos.avgPrice" [class.text-rose-500]="pos.markPrice < pos.avgPrice">&#x2192;</span>
                          <span class="text-slate-200 font-bold">\${{ pos.markPrice.toFixed(2) }}</span>
                        </div>
                      </td>
                      <td class="p-3 whitespace-nowrap">
                        <div class="font-bold font-mono text-xs tabular-nums" [class.text-emerald-500]="pos.unrealisedPnl >= 0" [class.text-rose-500]="pos.unrealisedPnl < 0">
                          {{ pos.unrealisedPnl >= 0 ? '+' : '' }}\${{ pos.unrealisedPnl.toFixed(2) }}
                        </div>
                        <div class="text-xs font-bold font-mono text-slate-400 tabular-nums">
                          {{ pnlPct >= 0 ? '+' : '' }}{{ pnlPct.toFixed(2) }}%
                        </div>
                      </td>
                      <td class="p-3 whitespace-nowrap min-w-[100px]">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-slate-200 font-mono text-xs tabular-nums">{{ weight.toFixed(1) }}%</span>
                          <div class="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden min-w-[40px]">
                            <div class="h-full bg-[#10b981] rounded-full" [style.width.%]="weight"></div>
                          </div>
                        </div>
                      </td>
                      <td class="p-3 whitespace-nowrap">
                        @if (pos.lastExecutionPrice && pos.lastExecutionSide) {
                          <span class="text-xs font-mono tabular-nums">
                            <span [class.text-emerald-400]="pos.lastExecutionSide === 'Buy'" [class.text-rose-400]="pos.lastExecutionSide === 'Sell'" class="font-bold">
                              {{ pos.lastExecutionSide === 'Buy' ? 'Buy' : 'Sell' }}
                            </span>
                            <span class="text-slate-400"> &#64; </span>
                            <span class="text-slate-200 font-bold">\${{ pos.lastExecutionPrice.toFixed(2) }}</span>
                          </span>
                        } @else {
                          <span class="text-slate-400">&mdash;</span>
                        }
                      </td>
                      <td class="p-3 whitespace-nowrap text-right">
                        <div class="inline-flex items-center gap-2 justify-end">
                          @if (isTp) {
                            <button 
                              (click)="$event.stopPropagation(); state.openOrderModal(pos.symbol, pos.side === 'Buy' ? 'Sell' : 'Buy', decision.qty, true, decision.reason, pos.leverage)" 
                              class="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 hover:text-white transition-all cursor-pointer shadow-lg shadow-emerald-500/15"
                            >
                              ⚡ TP
                            </button>
                          } @else if (isDca) {
                            <button 
                              (click)="$event.stopPropagation(); state.openOrderModal(pos.symbol, pos.side, decision.qty, false, decision.reason, pos.leverage)" 
                              class="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#0ea5e9] hover:bg-sky-600 text-slate-950 hover:text-white transition-all cursor-pointer shadow-lg shadow-sky-500/15"
                            >
                              ⚡ DCA
                            </button>
                          }
                          <button 
                            (click)="$event.stopPropagation(); state.openOrderModal(pos.symbol, pos.side === 'Buy' ? 'Sell' : 'Buy', pos.size, true, 'Manual Position Close', pos.leverage)" 
                            class="px-2.5 py-1 text-xs font-bold rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                          >
                            ✕ Close
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="flex flex-col items-center gap-3 py-14 bg-[#0f161c]/10 rounded-xl border border-slate-850">
              <span class="text-3xl text-slate-600">💼</span>
              <p class="text-xs text-slate-400 font-bold">No open positions on Bybit accounts at the moment.</p>
            </div>
          }
        } @else {
          <!-- Shimmering Positions Table Skeleton -->
          <div class="space-y-4 animate-pulse">
            <div class="flex flex-wrap gap-2 p-2 bg-[#0d131a] rounded-xl border border-slate-850">
              @for (badge of [1, 2, 3, 4, 5]; track badge) {
                <div class="h-5 w-20 rounded bg-[#141d24] skeleton-shimmer opacity-40"></div>
              }
            </div>

            <div class="border border-slate-850 rounded-xl bg-[#0f161c]/20 p-4 space-y-4">
              <div class="flex justify-between border-b border-slate-850 pb-3">
                <div class="h-3 w-16 rounded skeleton-shimmer opacity-30"></div>
                <div class="h-3 w-12 rounded skeleton-shimmer opacity-30"></div>
                <div class="h-3 w-28 rounded skeleton-shimmer opacity-30"></div>
                <div class="h-3 w-16 rounded skeleton-shimmer opacity-30"></div>
                <div class="h-3 w-20 rounded skeleton-shimmer opacity-30"></div>
              </div>
              @for (row of [1, 2, 3]; track row) {
                <div class="flex justify-between items-center py-2 border-b border-slate-850/30 last:border-0">
                  <div class="flex gap-2 w-1/4">
                    <div class="h-4 w-12 rounded skeleton-shimmer opacity-50"></div>
                    <div class="h-3 w-8 rounded skeleton-shimmer opacity-30"></div>
                  </div>
                  <div class="h-4 w-10 rounded skeleton-shimmer opacity-40"></div>
                  <div class="h-4 w-28 rounded skeleton-shimmer opacity-40"></div>
                  <div class="h-4 w-16 rounded skeleton-shimmer opacity-40"></div>
                  <div class="h-5 w-16 rounded skeleton-shimmer opacity-40"></div>
                </div>
              }
            </div>
          </div>
        }

      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionsTableComponent {
  state = inject(StateService);

  sortedPositions = computed(() => {
    return [...this.state.openPositions()].sort((a, b) => a.unrealisedPnl - b.unrealisedPnl);
  });

  getPositionWeight(pos: { positionValue: number }): number {
    const equity = this.state.equity();
    if (equity <= 0) return 0;
    return (pos.positionValue / equity) * 100;
  }

  getContribution(pos: { unrealisedPnl: number }): number {
    const initial = this.state.botBalance();
    if (initial <= 0) return 0;
    return (pos.unrealisedPnl / initial) * 100;
  }
}
