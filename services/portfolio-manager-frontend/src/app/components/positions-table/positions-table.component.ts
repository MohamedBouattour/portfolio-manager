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
        <button (click)="state.fetchOpenPositions()" class="btn btn-secondary btn-small">
          🔄 Refresh
        </button>
      </div>
      <div class="card-body">
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
