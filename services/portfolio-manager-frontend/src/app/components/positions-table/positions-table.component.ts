import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-positions-table',
  imports: [CommonModule],
  template: `
    <div class="card positions-card">
      <div class="card-header">
        <div class="flex-row align-center gap-10">
          <h3>💼 Live Bybit Positions</h3>
          <span 
            class="mode-badge" 
            [class.manual-mode]="state.manualMode()" 
            [class.auto-mode]="!state.manualMode()"
          >
            {{ state.manualMode() ? '🔴 MANUAL RUN GUARD ACTIVE' : '🟢 AUTO EXECUTION ACTIVE' }}
          </span>
        </div>
        <button (click)="state.fetchOpenPositions(); state.fetchWalletBalance()" class="btn btn-secondary btn-small">
          🔄 Refresh
        </button>
      </div>
      <div class="card-body">
        <!-- Balance Dashboard Grid -->
        @if (state.bybitBalance()) {
          <div class="balance-summary-grid">
            <div class="stat-card">
              <span class="stat-label">Initial Balance (.env)</span>
              <span class="stat-value">\${{ state.botBalance().toFixed(2) }}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">New Balance (Equity)</span>
              <span class="stat-value">\${{ state.equity().toFixed(2) }}</span>
            </div>
            <div class="stat-card" [class.positive-stat]="state.bybitTotalUnrealisedPnl() > 0" [class.negative-stat]="state.bybitTotalUnrealisedPnl() < 0">
              <span class="stat-label">Total Unrealised PnL</span>
              <span class="stat-value">
                {{ state.bybitTotalUnrealisedPnl() >= 0 ? '+' : '' }}\${{ state.bybitTotalUnrealisedPnl().toFixed(2) }}
              </span>
            </div>
            <div class="stat-card" [class.positive-stat]="state.roiFromInitial() > 0" [class.negative-stat]="state.roiFromInitial() < 0">
              <span class="stat-label">Total ROI</span>
              <span class="stat-value">
                {{ state.roiFromInitial() >= 0 ? '+' : '' }}{{ state.roiFromInitial().toFixed(2) }}%
              </span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Available USDT</span>
              <span class="stat-value">\${{ state.availableUsdt().toFixed(2) }}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Position Margin (Locked)</span>
              <span class="stat-value">\${{ state.positionMargin().toFixed(2) }}</span>
            </div>
          </div>
        } @else {
          <div class="balance-loading">
            <span>⏳ Loading wallet balance from Bybit...</span>
          </div>
        }

        <!-- Configuration/More Info Row -->
        <div class="config-info-bar">
          <span class="info-tag">⏱ Timeframe: <strong>{{ state.timeframe() }}</strong></span>
          <span class="info-tag">⚙ Leverage: <strong>{{ state.botLeverage() }}x</strong></span>
          <span class="info-tag">📈 Max Alloc: <strong>{{ state.maxAllocPct() }}%</strong></span>
          <span class="info-tag">🎯 Take Profit: <strong>+{{ state.profitThresholdPct() }}%</strong></span>
          <span class="info-tag">🔄 DCA Trigger: <strong>-{{ state.rebuyThresholdPct() }}%</strong></span>
          <span class="info-tag">📉 DCA Qty: <strong>+{{ state.rebuyQtyPct() }}%</strong></span>
          <span class="info-tag">✂ TP Reduce: <strong>-{{ state.reducePct() }}%</strong></span>
        </div>

        @if (state.openPositions().length > 0) {
          <div class="table-responsive">
            <table class="positions-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Size</th>
                  <th>Entry Price</th>
                  <th>Mark Price</th>
                  <th>PnL (Ratio)</th>
                  <th>Value</th>
                  <th>Leverage</th>
                  <th>Bot Decision</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                @for (pos of state.openPositions(); track pos.symbol) {
                  <tr 
                    [class.long-row]="pos.side === 'Buy'" 
                    [class.short-row]="pos.side === 'Sell'" 
                    (click)="state.selectAsset(pos.symbol)"
                  >
                    <td class="bold">{{ pos.symbol }}</td>
                    <td>
                      <span 
                        class="side-badge" 
                        [class.buy]="pos.side === 'Buy'" 
                        [class.sell]="pos.side === 'Sell'"
                      >
                        {{ pos.side === 'Buy' ? 'LONG' : 'SHORT' }}
                      </span>
                    </td>
                    <td>{{ pos.size }}</td>
                    <td>\${{ pos.avgPrice.toFixed(2) }}</td>
                    <td>\${{ pos.markPrice.toFixed(2) }}</td>
                    <td 
                      [class.green]="pos.unrealisedPnl > 0" 
                      [class.red]="pos.unrealisedPnl < 0" 
                      class="bold"
                    >
                      {{ pos.unrealisedPnl >= 0 ? '+' : '' }}\${{ pos.unrealisedPnl.toFixed(2) }}
                      ({{ pos.unrealisedPnl >= 0 ? '+' : '' }}{{ state.getPnlPercent(pos).toFixed(2) }}%)
                    </td>
                    <td>\${{ pos.positionValue.toFixed(2) }}</td>
                    <td>{{ pos.leverage }}x</td>
                    <td>
                      @if (state.getPositionDecision(pos).action === 'REDUCE') {
                        <span class="badge badge-reduce" [title]="state.getPositionDecision(pos).reason">🟢 REDUCE</span>
                      } @else if (state.getPositionDecision(pos).action === 'DCA_REBUY') {
                        <span class="badge badge-rebuy" [title]="state.getPositionDecision(pos).reason">🔵 DCA REBUY</span>
                      } @else {
                        <span class="badge badge-hold" [title]="state.getPositionDecision(pos).reason">🟡 HOLD</span>
                      }
                    </td>
                    <td>
                      <div class="flex-row gap-5">
                        @if (state.getPositionDecision(pos).action === 'REDUCE') {
                          <button 
                            (click)="$event.stopPropagation(); state.openOrderModal(pos.symbol, pos.side === 'Buy' ? 'Sell' : 'Buy', state.getPositionDecision(pos).qty, true, state.getPositionDecision(pos).reason, pos.leverage)" 
                            class="btn btn-small btn-tp-action"
                          >
                            ⚡ Execute TP
                          </button>
                        } @else if (state.getPositionDecision(pos).action === 'DCA_REBUY') {
                          <button 
                            (click)="$event.stopPropagation(); state.openOrderModal(pos.symbol, pos.side, state.getPositionDecision(pos).qty, false, state.getPositionDecision(pos).reason, pos.leverage)" 
                            class="btn btn-small btn-dca-action"
                          >
                            ⚡ Execute DCA
                          </button>
                        }
                        <button 
                          (click)="$event.stopPropagation(); state.openOrderModal(pos.symbol, pos.side === 'Buy' ? 'Sell' : 'Buy', pos.size, true, 'Manual Position Close', pos.leverage)" 
                          class="btn btn-close-position"
                        >
                          ✖ Close
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="no-positions-state">
            <span class="positions-icon">💼</span>
            <p>No open positions on Bybit at the moment.</p>
          </div>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionsTableComponent {
  state = inject(StateService);
}
