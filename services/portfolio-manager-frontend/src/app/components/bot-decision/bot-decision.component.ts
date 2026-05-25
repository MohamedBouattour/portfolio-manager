import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-bot-decision',
  imports: [CommonModule],
  template: `
    <div class="card decision-card">
      <div class="card-header">
        <div class="flex-row align-center gap-10">
          <h3>Bot Engine Decision</h3>
          @if (state.klines().length > 0 && state.selectedIndex() !== null) {
            <span 
              class="temporal-badge" 
              [class.live]="state.selectedIndex() === state.klines().length - 1" 
              [class.historical]="state.selectedIndex() !== state.klines().length - 1"
            >
              {{ state.selectedIndex() === state.klines().length - 1 ? '🔴 LIVE' : '📅 HISTORICAL' }}
            </span>
          }
        </div>
        @if (state.isEvaluating()) {
          <span class="eval-spinner"></span>
        }
      </div>

      <div class="decision-content">
        @if (state.evaluationResult()) {
          <!-- Entry Signal Scouting -->
          <div class="eval-block">
            <h4 class="block-title">1. Entry Signal Scouting</h4>
            <div class="signal-badge-wrapper">
              <div 
                class="signal-badge" 
                [class.success]="state.evaluationResult()!.strategySignal.shouldEnter"
                [class.neutral]="!state.evaluationResult()!.strategySignal.shouldEnter"
              >
                {{ state.evaluationResult()!.strategySignal.shouldEnter ? '🚀 LONG ENTRY SIGNAL DETECTED' : '💤 NO ENTRY SIGNAL' }}
              </div>
            </div>
            
            <div class="indicator-values">
              <div class="ind-pill">
                <span class="ind-name">MACD</span>
                <span 
                  class="ind-val" 
                  [class.green]="state.evaluationResult()!.strategySignal.macdValue > 0" 
                  [class.red]="state.evaluationResult()!.strategySignal.macdValue < 0"
                >
                  {{ state.evaluationResult()!.strategySignal.macdValue.toFixed(4) }}
                </span>
              </div>
              <div class="ind-pill">
                <span class="ind-name">Signal</span>
                <span class="ind-val">
                  {{ state.evaluationResult()!.strategySignal.signalValue.toFixed(4) }}
                </span>
              </div>
              <div class="ind-pill">
                <span class="ind-name">Histogram</span>
                <span 
                  class="ind-val" 
                  [class.green]="state.evaluationResult()!.strategySignal.histValue > 0" 
                  [class.red]="state.evaluationResult()!.strategySignal.histValue < 0"
                >
                  {{ state.evaluationResult()!.strategySignal.histValue.toFixed(4) }}
                </span>
              </div>
            </div>
            <p class="explanation">
              Uptrend entry is triggered when the MACD line crosses above the Signal line (crossover) while both are <strong>strictly below 0</strong> on the {{ state.timeframe() }} timeframe (USDT stock perpetual contracts only).
            </p>
          </div>

          <!-- Position Management -->
          <div class="eval-block border-top">
            <h4 class="block-title">2. Position Management</h4>
            <div class="action-card-wrapper">
              <div 
                class="action-badge" 
                [class.action-hold]="state.evaluationResult()!.positionDecision.action === 'HOLD'"
                [class.action-reduce]="state.evaluationResult()!.positionDecision.action === 'REDUCE'"
                [class.action-rebuy]="state.evaluationResult()!.positionDecision.action === 'DCA_REBUY'"
              >
                @if (state.evaluationResult()!.positionDecision.action === 'HOLD') {
                  <span>🤝 HOLD POSITION</span>
                } @else if (state.evaluationResult()!.positionDecision.action === 'REDUCE') {
                  <span>💰 TAKE PROFIT / REDUCE (Reduce Size by {{ state.evaluationResult()!.positionDecision.qty }} units)</span>
                } @else if (state.evaluationResult()!.positionDecision.action === 'DCA_REBUY') {
                  <span>➕ DCA REBUY (Buy {{ state.evaluationResult()!.positionDecision.qty }} units)</span>
                }
              </div>
            </div>
            <div class="reason-log">
              <span class="log-label">Engine Log Output:</span>
              <p class="log-text">{{ state.evaluationResult()!.positionDecision.reason }}</p>
            </div>
          </div>

          <!-- Manual Order Confirmation Button -->
          @if (state.getSuggestedOrder(); as order) {
            <div class="manual-order-confirmation border-top">
              <h4 class="block-title font-gold">⚡ Manual Order Execution</h4>
              <div class="order-details-box">
                <div class="detail-row">
                  <span>Symbol:</span>
                  <strong class="highlight-val">{{ order.symbol }}</strong>
                </div>
                <div class="detail-row">
                  <span>Action:</span>
                  <strong [class.buy-text]="order.side === 'Buy'" [class.sell-text]="order.side === 'Sell'">
                    {{ order.side === 'Buy' ? 'BUY (Entry / DCA)' : 'SELL (Take Profit / Reduce)' }}
                  </strong>
                </div>
                <div class="detail-row">
                  <span>Size:</span>
                  <strong class="highlight-val">{{ order.qty }} units</strong>
                </div>
                <div class="detail-row">
                  <span>Est. Value:</span>
                  <strong>\${{ order.notional }}</strong>
                </div>
                <div class="detail-row">
                  <span>Est. Margin:</span>
                  <strong>\${{ order.margin }} ({{ state.botLeverage() }}x)</strong>
                </div>
                <div class="detail-row">
                  <span>Reason:</span>
                  <span class="reason-note">{{ order.reason }}</span>
                </div>
              </div>

              <div class="confirm-action-row">
                <button 
                  (click)="state.openOrderModal(order.symbol, order.side, order.qty, order.reduceOnly, order.reason, state.botLeverage())" 
                  class="btn btn-primary btn-confirm-order"
                >
                  🚀 Validate Bot Decision
                </button>
              </div>
            </div>
          }
        } @else {
          <div class="decision-placeholder">
            <span class="placeholder-icon">📊</span>
            <p>Click on any point on the chart timeline to view the trading bot's simulated evaluation decision at that interval.</p>
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
