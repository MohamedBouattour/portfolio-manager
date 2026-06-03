import { Component, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-positions-table',
  imports: [CommonModule],
  template: `
    <div class="card positions-card">
      <div class="card-header flex-wrap gap-2">
        <div class="flex items-center gap-2.5">
          <h3 class="text-sm font-semibold text-slate-100">&#x1F4BC; Live Bybit Positions</h3>
          <span
            [ngClass]="state.manualMode() ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'"
            class="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full border"
          >
            {{ state.manualMode() ? '🔴 MANUAL RUN GUARD ACTIVE' : '🟢 AUTO EXECUTION ACTIVE' }}
          </span>
        </div>
        <button (click)="state.fetchOpenPositions(); state.fetchWalletBalance()" class="btn btn-secondary btn-small">
          🔄 Refresh
        </button>
      </div>
      <div class="card-body">
        @if (state.bybitBalance()) {
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4 bg-slate-900/40 p-3.5 rounded-xl border border-slate-700/30">
            <div class="flex flex-col gap-1 bg-slate-700/30 border border-slate-600/20 p-3 rounded-lg hover:-translate-y-0.5 hover:border-blue-500/30 hover:bg-slate-700/50 transition-all">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Initial Balance</span>
              <span class="text-sm font-bold text-slate-100">\${{ state.botBalance().toFixed(2) }}</span>
            </div>
            <div class="flex flex-col gap-1 bg-slate-700/30 border border-slate-600/20 p-3 rounded-lg hover:-translate-y-0.5 hover:border-blue-500/30 hover:bg-slate-700/50 transition-all">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Equity (current)</span>
              <span class="text-sm font-bold text-slate-100">\${{ state.equity().toFixed(2) }}</span>
            </div>
            <div class="flex flex-col gap-1 bg-slate-700/30 border border-slate-600/20 p-3 rounded-lg hover:-translate-y-0.5 hover:border-blue-500/30 hover:bg-slate-700/50 transition-all">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Available USDT</span>
              <span class="text-sm font-bold text-slate-100">\${{ state.availableUsdt().toFixed(2) }}</span>
            </div>
            <div class="flex flex-col gap-1 bg-slate-700/30 border border-slate-600/20 p-3 rounded-lg hover:-translate-y-0.5 hover:border-blue-500/30 hover:bg-slate-700/50 transition-all">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Margin Locked</span>
              <span class="text-sm font-bold text-slate-100">\${{ state.positionMargin().toFixed(2) }}</span>
            </div>
            <div class="flex flex-col gap-1 bg-slate-700/30 border p-3 rounded-lg transition-all" [class.border-l-emerald-500]="state.totalFloatingPnl() >= 0" [class.border-l-rose-500]="state.totalFloatingPnl() < 0">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">PnL (total)</span>
              <span class="text-sm font-bold" [class.text-emerald-500]="state.totalFloatingPnl() >= 0" [class.text-rose-400]="state.totalFloatingPnl() < 0">
                {{ state.totalFloatingPnl() >= 0 ? '+' : '' }}\${{ state.totalFloatingPnl().toFixed(2) }}
              </span>
            </div>
            <div class="flex flex-col gap-1 bg-slate-700/30 border p-3 rounded-lg transition-all" [class.border-l-emerald-500]="state.roiFromInitial() > 0" [class.border-l-rose-500]="state.roiFromInitial() < 0">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">&#x1F3C6; Portfolio ROI</span>
              <span class="text-sm font-bold" [class.text-emerald-500]="state.roiFromInitial() > 0" [class.text-rose-400]="state.roiFromInitial() < 0">
                {{ state.roiFromInitial() >= 0 ? '+' : '' }}{{ state.roiFromInitial().toFixed(2) }}%
              </span>
              <span class="text-[10px] text-slate-500">On \${{ state.botBalance().toFixed(0) }} initial</span>
            </div>
          </div>
        } @else {
          <div class="flex items-center justify-center py-6 text-sm text-slate-400 bg-slate-900/20 rounded-lg border border-slate-700/20 mb-4">
            <span>&#x23F3; Loading wallet balance from Bybit...</span>
          </div>
        }

        <div class="flex flex-wrap gap-3 p-2.5 mb-5 bg-slate-900/20 rounded-lg border border-dashed border-slate-700/50">
          <span class="text-[11px] text-slate-400 bg-slate-700/40 px-2 py-1 rounded border border-slate-600/20">&#x23F1; <strong class="text-slate-100">{{ state.timeframe() }}</strong></span>
          <span class="text-[11px] text-slate-400 bg-slate-700/40 px-2 py-1 rounded border border-slate-600/20">&#x2699; <strong class="text-slate-100">{{ state.botLeverage() }}x</strong></span>
          <span class="text-[11px] text-slate-400 bg-slate-700/40 px-2 py-1 rounded border border-slate-600/20">&#x1F4C8; Max <strong class="text-slate-100">{{ state.maxAllocPct() }}%</strong></span>
          <span class="text-[11px] text-slate-400 bg-slate-700/40 px-2 py-1 rounded border border-slate-600/20">&#x1F3AF; TP <strong class="text-slate-100">+{{ state.profitThresholdPct() }}%</strong></span>
          <span class="text-[11px] text-slate-400 bg-slate-700/40 px-2 py-1 rounded border border-slate-600/20">&#x1F504; DCA <strong class="text-slate-100">-{{ state.rebuyThresholdPct() }}%</strong></span>
          <span class="text-[11px] text-slate-400 bg-slate-700/40 px-2 py-1 rounded border border-slate-600/20">&#x1F4C9; Add <strong class="text-slate-100">+{{ state.rebuyQtyPct() }}%</strong></span>
          <span class="text-[11px] text-slate-400 bg-slate-700/40 px-2 py-1 rounded border border-slate-600/20">&#x2702; Reduce <strong class="text-slate-100">-{{ state.reducePct() }}%</strong></span>
        </div>

        @if (state.openPositions().length > 0) {
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-left text-xs">
              <thead>
                <tr>
                  <th class="p-2.5 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 whitespace-nowrap">Asset</th>
                  <th class="p-2.5 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 whitespace-nowrap">Size</th>
                  <th class="p-2.5 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 whitespace-nowrap">Entry &#x2192; Mark</th>
                  <th class="p-2.5 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 whitespace-nowrap">PnL</th>
                  <th class="p-2.5 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 whitespace-nowrap">Impact</th>
                  <th class="p-2.5 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 whitespace-nowrap">Last Action</th>
                  <th class="p-2.5 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 whitespace-nowrap">Value</th>
                  <th class="p-2.5 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 whitespace-nowrap">Lev.</th>
                  <th class="p-2.5 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 whitespace-nowrap">Decision</th>
                  <th class="p-2.5 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-700/50 whitespace-nowrap">Execute</th>
                </tr>
              </thead>
              <tbody>
                  @for (pos of sortedPositions(); track pos.symbol) {
                    @let decision = state.getPositionDecision(pos);
                    @let pnlPct = state.getPnlPercent(pos);
                    @let weight = getPositionWeight(pos);
                    @let contrib = getContribution(pos);
                    @let isDca = decision.action === 'DCA_REBUY';
                    @let isTp = decision.action === 'REDUCE';
                    @let dcaQty = state.rebuyQtyPct() / 100 * pos.size;
                    @let dcaCost = dcaQty * pos.markPrice;
                    @let newSize = pos.size + dcaQty;
                    @let newAvg = (pos.positionValue + dcaCost) / newSize;
                    <tr
                      (click)="state.selectAsset(pos.symbol)"
                      class="cursor-pointer transition-colors hover:bg-slate-700/15"
                      [ngClass]="isTp ? 'bg-emerald-500/[0.07]' : isDca ? 'bg-blue-500/[0.07]' : pos.side === 'Buy' ? 'bg-emerald-500/5' : pos.side === 'Sell' ? 'bg-rose-500/5' : ''"
                    >
                      <td class="p-2.5 border-b border-slate-700/20 whitespace-nowrap">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-white">{{ pos.symbol }}</span>
                          <span
                            class="text-[11px] font-bold px-1.5 py-0.5 rounded border"
                            [ngClass]="pos.side === 'Buy' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/40'"
                          >
                            {{ pos.side === 'Buy' ? 'LONG' : 'SHORT' }}
                          </span>
                        </div>
                      </td>
                      <td class="p-2.5 border-b border-slate-700/20 whitespace-nowrap">
                        <span class="font-semibold text-slate-200">{{ pos.size }}</span>
                      </td>
                      <td class="p-2.5 border-b border-slate-700/20 whitespace-nowrap">
                        <div class="flex items-center gap-1.5">
                          <span class="text-slate-400">\${{ pos.avgPrice.toFixed(2) }}</span>
                          <span [class.text-emerald-500]="pos.markPrice >= pos.avgPrice" [class.text-rose-400]="pos.markPrice < pos.avgPrice">&#x2192;</span>
                          <span class="text-slate-200">\${{ pos.markPrice.toFixed(2) }}</span>
                        </div>
                      </td>
                      <td
                        class="p-2.5 border-b border-slate-700/20 whitespace-nowrap"
                        [class.text-emerald-500]="pos.unrealisedPnl > 0"
                        [class.text-rose-400]="pos.unrealisedPnl < 0"
                      >
                        <div class="font-bold">{{ pos.unrealisedPnl >= 0 ? '+' : '' }}\${{ pos.unrealisedPnl.toFixed(2) }}</div>
                        <div class="text-[11px] font-semibold" [ngClass]="pos.unrealisedPnl > 0 ? 'text-emerald-500/80' : pos.unrealisedPnl < 0 ? 'text-rose-400/80' : ''">
                          {{ pos.unrealisedPnl >= 0 ? '+' : '' }}{{ pnlPct.toFixed(2) }}% <span class="font-normal text-slate-500">on margin</span>
                        </div>
                      </td>
                      <td class="p-2.5 border-b border-slate-700/20 whitespace-nowrap">
                        <div class="font-semibold text-xs">{{ contrib >= 0 ? '+' : '' }}{{ contrib.toFixed(2) }}% <span class="font-normal text-slate-500">of portfolio</span></div>
                        <div class="w-full h-1.5 bg-slate-700/40 rounded-full overflow-hidden mt-1 min-w-[60px]">
                          <div class="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400" [style.width.%]="weight"></div>
                        </div>
                      </td>
                      <td class="p-2.5 border-b border-slate-700/20 whitespace-nowrap">
                        @if (pos.lastExecutionPrice && pos.lastExecutionSide) {
                          <span class="text-xs">
                            <span [class.text-emerald-400]="pos.lastExecutionSide === 'Buy'" [class.text-rose-400]="pos.lastExecutionSide === 'Sell'" class="font-semibold">
                              {{ pos.lastExecutionSide === 'Buy' ? 'Buy' : 'Sell' }}
                            </span>
                            <span class="text-slate-500">&commat;</span>
                            <span class="text-slate-300">\${{ pos.lastExecutionPrice.toFixed(2) }}</span>
                          </span>
                        } @else {
                          <span class="text-slate-500">&mdash;</span>
                        }
                      </td>
                      <td class="p-2.5 border-b border-slate-700/20 whitespace-nowrap text-slate-200 font-medium">\${{ pos.positionValue.toFixed(2) }}</td>
                      <td class="p-2.5 border-b border-slate-700/20 whitespace-nowrap">{{ pos.leverage }}x</td>
                      <td class="p-2.5 border-b border-slate-700/20 min-w-[180px]">
                        <div class="space-y-1">
                          @if (isTp) {
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">&#x1F7E2; TAKE PROFIT</span>
                          } @else if (isDca) {
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">&#x1F535; DCA REBUY</span>
                          } @else {
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">&#x1F7E1; HOLD</span>
                          }
                          <div class="text-[11px] text-slate-400">{{ decision.reason }}</div>
                          @if (isDca) {
                            <div class="bg-slate-900/80 border border-slate-700/30 rounded-lg p-2.5 mt-1 space-y-1.5">
                              <div class="text-[11px] font-semibold text-slate-400">&#x1F4CB; If DCA runs at market price:</div>
                              <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                                <span class="text-slate-500">Add</span>
                                <strong class="text-slate-200 text-right">{{ dcaQty.toFixed(4) }} units</strong>
                                <span class="text-slate-500">at</span>
                                <strong class="text-slate-200 text-right">\${{ pos.markPrice.toFixed(2) }}</strong>
                                <span class="text-slate-500">Cost</span>
                                <strong class="text-slate-200 text-right">\${{ dcaCost.toFixed(2) }}</strong>
                                <span class="text-slate-500">New avg price</span>
                                <strong class="text-blue-400 text-right">\${{ newAvg.toFixed(2) }}</strong>
                                <span class="text-slate-500">New total size</span>
                                <strong class="text-slate-200 text-right">{{ newSize.toFixed(4) }}</strong>
                              </div>
                            </div>
                          }
                        </div>
                      </td>
                      <td class="p-2.5 border-b border-slate-700/20 whitespace-nowrap">
                        <div class="flex flex-col gap-1.5">
                          @if (isTp) {
                            <button (click)="$event.stopPropagation(); state.openOrderModal(pos.symbol, pos.side === 'Buy' ? 'Sell' : 'Buy', decision.qty, true, decision.reason, pos.leverage)" class="btn text-[11px] font-bold px-2 py-1 rounded-md bg-gradient-to-r from-emerald-500 to-emerald-700 text-white border-none shadow-[0_4px_10px_rgba(16,185,129,0.2)] hover:from-emerald-400 hover:to-emerald-600 hover:-translate-y-0.5 transition-all" title="Execute take-profit">
                              &#x26A1; TP
                            </button>
                          } @else if (isDca) {
                            <button (click)="$event.stopPropagation(); state.openOrderModal(pos.symbol, pos.side, decision.qty, false, decision.reason, pos.leverage)" class="btn text-[11px] font-bold px-2 py-1 rounded-md bg-gradient-to-r from-blue-500 to-blue-700 text-white border-none shadow-[0_4px_10px_rgba(59,130,246,0.2)] hover:from-blue-400 hover:to-blue-600 hover:-translate-y-0.5 transition-all" title="Execute DCA">
                              &#x26A1; DCA
                            </button>
                          }
                          <button (click)="$event.stopPropagation(); state.openOrderModal(pos.symbol, pos.side === 'Buy' ? 'Sell' : 'Buy', pos.size, true, 'Manual Position Close', pos.leverage)" class="btn text-[11px] font-bold px-2 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/30 hover:text-white transition-all" title="Close entire position">
                            &#x2716; Close
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
              </tbody>
            </table>
          </div>
          <div class="mt-3 space-y-1 text-[11px] text-slate-500">
            <div class="flex flex-wrap gap-x-4 gap-y-1">
              <span><strong class="text-slate-400">On margin %</strong> = PnL &#xF7; (position value &#xF7; leverage)</span>
              <span><strong class="text-slate-400">Portfolio impact</strong> = position PnL &#xF7; initial balance</span>
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-1">
              <span><strong class="text-slate-400">Weight</strong> = position value &#xF7; equity</span>
              <span><strong class="text-slate-400">Last bot action</strong> from local execution store</span>
            </div>
          </div>
        } @else {
          <div class="flex flex-col items-center gap-3 py-8 text-slate-400">
            <span class="text-2xl">&#x1F4BC;</span>
            <p class="text-xs">No open positions on Bybit at the moment.</p>
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
