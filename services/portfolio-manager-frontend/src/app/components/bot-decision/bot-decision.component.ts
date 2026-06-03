import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-bot-decision',
  imports: [CommonModule],
  template: `
    <div class="card decision-card flex flex-col">
      <div class="card-header flex-wrap gap-2">
        <div class="flex items-center gap-2.5">
          <h3 class="text-sm font-semibold text-slate-100">Bot Engine Decision</h3>
          @if (state.klines().length > 0 && state.selectedIndex() !== null) {
            @let isLive = state.selectedIndex() === state.klines().length - 1;
            <span
              [ngClass]="isLive ? 'bg-rose-500/15 text-rose-400 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.15)]' : 'bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(251,191,36,0.15)]'"
              class="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full border"
            >
              {{ isLive ? '🔴 LIVE' : '📅 HISTORICAL' }}
            </span>
          }
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Timeframe:</span>
          <select [value]="state.timeframe()" (change)="onTimeframeChange($any($event.target).value)" class="bg-slate-900 border border-slate-600/70 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-100 cursor-pointer outline-none transition-all focus:border-blue-500">
            <option value="1h">1h (60m)</option>
            <option value="4h">4h (240m)</option>
            <option value="1D">1D (Daily)</option>
          </select>
        </div>
        @if (state.isEvaluating()) {
          <span class="eval-spinner"></span>
        }
      </div>

      <div class="p-5 flex-1 flex flex-col justify-center">
        @if (state.evaluationResult()) {
          <div class="space-y-3.5">
            <div>
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">1. Entry Signal Scouting</h4>
              @let shouldEnter = state.evaluationResult()!.strategySignal.shouldEnter;
              <div
                [ngClass]="shouldEnter ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.1)]' : 'bg-slate-700/30 text-slate-400 border-slate-600/50'"
                class="w-full py-3 px-4 rounded-lg text-xs font-bold text-center border"
              >
                {{ shouldEnter ? '🚀 LONG ENTRY SIGNAL DETECTED' : '💤 NO ENTRY SIGNAL' }}
              </div>

              <div class="flex gap-2 mt-3">
                @let signal = state.evaluationResult()!.strategySignal;
                <div class="flex-1 bg-slate-900 border border-slate-700/40 rounded-lg p-2 flex flex-col items-center gap-1">
                  <span class="text-[11px] font-semibold text-slate-400">MACD</span>
                  <span class="text-xs font-bold" [class.text-emerald-500]="signal.macdValue > 0" [class.text-rose-500]="signal.macdValue < 0">
                    {{ signal.macdValue.toFixed(4) }}
                  </span>
                </div>
                <div class="flex-1 bg-slate-900 border border-slate-700/40 rounded-lg p-2 flex flex-col items-center gap-1">
                  <span class="text-[11px] font-semibold text-slate-400">Signal</span>
                  <span class="text-xs font-bold text-slate-200">{{ signal.signalValue.toFixed(4) }}</span>
                </div>
                <div class="flex-1 bg-slate-900 border border-slate-700/40 rounded-lg p-2 flex flex-col items-center gap-1">
                  <span class="text-[11px] font-semibold text-slate-400">Histogram</span>
                  <span class="text-xs font-bold" [class.text-emerald-500]="signal.histValue > 0" [class.text-rose-500]="signal.histValue < 0">
                    {{ signal.histValue.toFixed(4) }}
                  </span>
                </div>
              </div>
              <p class="text-[11px] text-slate-400 leading-relaxed mt-2">
                Uptrend entry is triggered when the MACD line crosses above the Signal line (crossover) while both are <strong class="text-slate-200">strictly below 0</strong> on the {{ state.timeframe() }} timeframe (USDT stock perpetual contracts only).
              </p>
            </div>

            <div class="border-t border-slate-700/40 pt-4 space-y-3">
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400">2. Position Management</h4>
              @let action = state.evaluationResult()!.positionDecision.action;
              <div
                [ngClass]="action === 'HOLD' ? 'bg-slate-600/20 text-slate-300 border-slate-600/40' : action === 'REDUCE' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.1)]' : 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.1)]'"
                class="w-full py-3.5 px-4 rounded-lg text-xs font-bold text-center border"
              >
                @if (action === 'HOLD') {
                  <span>&#x1F91D; HOLD POSITION</span>
                } @else if (action === 'REDUCE') {
                  <span>&#x1F4B0; TAKE PROFIT / REDUCE (Reduce Size by {{ state.evaluationResult()!.positionDecision.qty }} units)</span>
                } @else {
                  <span>&#x2795; DCA REBUY (Buy {{ state.evaluationResult()!.positionDecision.qty }} units)</span>
                }
              </div>
              <div class="bg-slate-900 border border-slate-700/40 rounded-lg p-3.5">
                <span class="text-[11px] font-bold uppercase text-slate-400 block mb-1">Engine Log Output:</span>
                <p class="text-[11px] text-slate-300 leading-relaxed m-0">{{ state.evaluationResult()!.positionDecision.reason }}</p>
              </div>
            </div>

            @if (state.getSuggestedOrder(); as order) {
              <div class="border-t border-slate-700/40 pt-4 space-y-4">
                <h4 class="text-xs font-bold text-amber-400">&#x26A1; Manual Order Execution</h4>
                <div class="bg-slate-900/80 border border-slate-600/40 rounded-xl p-3.5 space-y-2">
                  <div class="flex justify-between items-center text-xs text-slate-400">
                    <span>Symbol:</span>
                    <strong class="text-blue-400">{{ order.symbol }}</strong>
                  </div>
                  <div class="flex justify-between items-center text-xs text-slate-400">
                    <span>Action:</span>
                    <strong [class.text-emerald-400]="order.side === 'Buy'" [class.text-rose-400]="order.side === 'Sell'">
                      {{ order.side === 'Buy' ? 'BUY (Entry / DCA)' : 'SELL (Take Profit / Reduce)' }}
                    </strong>
                  </div>
                  <div class="flex justify-between items-center text-xs text-slate-400">
                    <span>Size:</span>
                    <strong class="text-blue-400">{{ order.qty }} units</strong>
                  </div>
                  <div class="flex justify-between items-center text-xs text-slate-400">
                    <span>Est. Value:</span>
                    <strong>\${{ order.notional }}</strong>
                  </div>
                  <div class="flex justify-between items-center text-xs text-slate-400">
                    <span>Est. Margin:</span>
                    <strong>\${{ order.margin }} ({{ state.botLeverage() }}x)</strong>
                  </div>
                  <div class="flex justify-between items-center text-xs text-slate-400">
                    <span>Reason:</span>
                    <span class="text-slate-300 italic text-right max-w-[65%]">{{ order.reason }}</span>
                  </div>
                </div>

                <div class="flex justify-end">
                  <button (click)="state.openOrderModal(order.symbol, order.side, order.qty, order.reduceOnly, order.reason, state.botLeverage())" class="btn btn-primary w-full py-3 justify-center font-bold text-sm">
                    &#x1F680; Validate Bot Decision
                  </button>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="flex flex-col items-center text-center text-slate-400 gap-3 py-10">
            <span class="text-3xl">&#x1F4CA;</span>
            <p class="text-xs leading-relaxed m-0">Click on any point on the chart timeline to view the trading bot's simulated evaluation decision at that interval.</p>
          </div>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BotDecisionComponent {
  state = inject(StateService);

  onTimeframeChange(tf: string) {
    this.state.updateTimeframe(tf);
  }
}
