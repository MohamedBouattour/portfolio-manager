import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-bot-decision',
  imports: [CommonModule],
  template: `
    <div class="bg-[#141d24]/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full">
      <div class="px-5 py-4 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-3 bg-[#18232c]/50">
        <div class="flex items-center gap-2.5">
          <h3 class="text-sm font-extrabold text-white tracking-wide">Bot Engine Decision</h3>
          @if (state.klines().length > 0 && state.selectedIndex() !== null) {
            @let isLive = state.selectedIndex() === state.klines().length - 1;
            <span
              [ngClass]="isLive ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'"
              class="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full border tracking-wider"
            >
              {{ isLive ? 'Live Interval' : 'Historical' }}
            </span>
          }
        </div>
        
        @if (state.isEvaluating()) {
          <span class="spinner !w-3.5 !h-3.5 !border-amber-400/20 !border-t-amber-400 inline-block"></span>
        }
      </div>

      <div class="p-5 flex-1 flex flex-col justify-center bg-[#0d131a]/40">
        @if (state.evaluationResult()) {
          @let evalRes = state.evaluationResult()!;
          <div class="space-y-5">
            
            <!-- Section 1: Entry Scouting -->
            <div>
              <h4 class="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">1. Entry Signal Scouting</h4>
              @let shouldEnter = evalRes.strategySignal.shouldEnter;
              <div
                [ngClass]="shouldEnter ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.06)]' : 'bg-[#151c24] text-slate-400 border-slate-850'"
                class="w-full py-3 px-4 rounded-xl text-xs font-bold text-center border tracking-wide"
              >
                {{ shouldEnter ? '🚀 LONG ENTRY SIGNAL DETECTED' : '💤 NO ENTRY SIGNAL ACTIVE' }}
              </div>

              <!-- Parameter stats -->
              <div class="grid grid-cols-3 gap-2.5 mt-3 text-center">
                <div class="bg-[#0f161c] border border-slate-850 rounded-xl p-2 flex flex-col items-center">
                  <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">MACD</span>
                  <span class="text-xs font-bold mt-1 font-mono" [class.text-emerald-400]="evalRes.strategySignal.macdValue > 0" [class.text-rose-500]="evalRes.strategySignal.macdValue < 0">
                    {{ evalRes.strategySignal.macdValue.toFixed(4) }}
                  </span>
                </div>
                <div class="bg-[#0f161c] border border-slate-850 rounded-xl p-2 flex flex-col items-center">
                  <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">Signal</span>
                  <span class="text-xs font-bold mt-1 text-slate-200 font-mono">
                    {{ evalRes.strategySignal.signalValue.toFixed(4) }}
                  </span>
                </div>
                <div class="bg-[#0f161c] border border-slate-850 rounded-xl p-2 flex flex-col items-center">
                  <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">Histogram</span>
                  <span class="text-xs font-bold mt-1 font-mono" [class.text-emerald-400]="evalRes.strategySignal.histValue > 0" [class.text-rose-500]="evalRes.strategySignal.histValue < 0">
                    {{ evalRes.strategySignal.histValue.toFixed(4) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Section 2: Position Management -->
            <div class="border-t border-slate-800/60 pt-4 space-y-3.5">
              <h4 class="text-xs font-extrabold uppercase tracking-wider text-slate-400">2. Position Management</h4>
              @let action = evalRes.positionDecision.action;
              <div
                [ngClass]="action === 'HOLD' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.06)]' : action === 'REDUCE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.06)]' : 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-[0_0_12px_rgba(56,189,248,0.06)]'"
                class="w-full py-3.5 px-4 rounded-xl text-xs font-bold text-center border tracking-wide"
              >
                @if (action === 'HOLD') {
                  <span>🤝 HOLD CURRENT POSITION</span>
                } @else if (action === 'REDUCE') {
                  <span>💰 TAKE PROFIT / REDUCE (Sell {{ evalRes.positionDecision.qty }} units)</span>
                } @else {
                  <span>➕ DCA REBUY (Buy {{ evalRes.positionDecision.qty }} units)</span>
                }
              </div>
              
              <!-- Engine Reason Log -->
              <div class="bg-[#0f161c] border border-slate-850 rounded-xl p-3.5">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Engine Evaluation Log:</span>
                <p class="text-xs font-medium text-slate-300 leading-relaxed m-0 font-sans italic">{{ evalRes.positionDecision.reason }}</p>
              </div>
            </div>

            <!-- Section 3: Suggested Order Execution -->
            @if (state.getSuggestedOrder(); as order) {
              <div class="border-t border-slate-800/60 pt-4 space-y-3.5">
                <h4 class="text-xs font-extrabold uppercase tracking-wider text-amber-400">⚡ Action Required: Validate Order</h4>
                
                <div class="bg-[#0f161c] border border-slate-850 rounded-xl p-4 space-y-2.5 font-mono text-xs text-slate-400">
                  <div class="flex justify-between items-center">
                    <span>SYMBOL</span>
                    <strong class="text-sky-400 font-bold">{{ order.symbol }}</strong>
                  </div>
                  <div class="flex justify-between items-center">
                    <span>ACTION</span>
                    <strong [class.text-emerald-400]="order.side === 'Buy'" [class.text-rose-400]="order.side === 'Sell'">
                      {{ order.side === 'Buy' ? 'BUY (LONG)' : 'SELL (SHORT)' }}
                    </strong>
                  </div>
                  <div class="flex justify-between items-center">
                    <span>QUANTITY</span>
                    <strong class="text-white">{{ order.qty }} units</strong>
                  </div>
                  <div class="flex justify-between items-center">
                    <span>EST VALUE</span>
                    <strong class="text-white">\${{ order.notional }}</strong>
                  </div>
                  <div class="flex justify-between items-center">
                    <span>EST MARGIN</span>
                    <strong class="text-white">\${{ order.margin }} ({{ state.botLeverage() }}x)</strong>
                  </div>
                </div>

                <button 
                  (click)="state.openOrderModal(order.symbol, order.side, order.qty, order.reduceOnly, order.reason, state.botLeverage())" 
                  class="btn w-full py-3 bg-gradient-to-r from-emerald-500 to-[#0ea5e9] text-slate-950 font-bold hover:text-white rounded-xl shadow-[0_4px_16px_rgba(16,185,129,0.2)] hover:from-emerald-400 hover:to-sky-500 transition-all text-xs tracking-wider"
                >
                  🚀 Validate Bot Decision
                </button>
              </div>
            }
          </div>
        } @else {
          <div class="flex flex-col items-center text-center text-slate-400 gap-3 py-14">
            <span class="text-4xl">&#x1f4ca;</span>
            <p class="text-xs leading-relaxed max-w-[220px]">Click on any point on the chart timeline to view the trading bot's simulated evaluation decision at that interval.</p>
          </div>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BotDecisionComponent {
  state = inject(StateService);
}
