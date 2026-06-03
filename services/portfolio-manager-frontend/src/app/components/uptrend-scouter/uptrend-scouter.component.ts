import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-uptrend-scouter',
  imports: [CommonModule],
  template: `
    <div class="card scouter-dashboard-card">
      <div class="card-header">
        <div class="flex-row align-center gap-10">
          <h3>📡 Market Scouter</h3>
          <div class="timeframe-badge">
            <span class="label">Timeframe:</span>
            <span class="badge">1D (Daily)</span>
          </div>
        </div>
        <div class="scouter-header-right">
          <span class="scout-badge">
            Scanning {{ state.scoutingResults().length }} Assets
          </span>
        </div>
      </div>

      <!-- Summary Banner -->
      <div class="scouter-summary-bar">
        <div class="summary-chip entry-chip">
          <span class="chip-dot entry-dot"></span>
          <span class="chip-count">{{ state.getScoutingSummary().entry }}</span>
          <span class="chip-label">Entry Signals</span>
        </div>
        <div class="summary-chip near-chip">
          <span class="chip-dot near-dot"></span>
          <span class="chip-count">{{ state.getScoutingSummary().nearSignal }}</span>
          <span class="chip-label">Near Signal</span>
        </div>
        <div class="summary-chip idle-chip">
          <span class="chip-dot idle-dot"></span>
          <span class="chip-count">{{ state.getScoutingSummary().noSignal }}</span>
          <span class="chip-label">No Signal</span>
        </div>
      </div>

      <!-- Scouting Table -->
      <div class="scouter-table-wrapper">
        @if (state.sortedScoutingResults().length > 0) {
          <table class="scouter-table">
            <thead>
              <tr>
                <th class="th-asset">Asset</th>
                <th class="th-sortable" (click)="state.toggleScoutingSort('price')">
                  Price
                  <span class="sort-icon">{{ getSortIcon('price') }}</span>
                </th>
                <th class="th-sortable th-confidence" (click)="state.toggleScoutingSort('confidence')">
                  Confidence
                  <span class="sort-icon">{{ getSortIcon('confidence') }}</span>
                </th>
                <th class="th-strategies">Strategies</th>
                <th class="th-sortable" (click)="state.toggleScoutingSort('rsi')">
                  RSI
                  <span class="sort-icon">{{ getSortIcon('rsi') }}</span>
                </th>
                <th class="th-sortable" (click)="state.toggleScoutingSort('histogram')">
                  MACD Hist
                  <span class="sort-icon">{{ getSortIcon('histogram') }}</span>
                </th>
                <th class="th-sortable" (click)="state.toggleScoutingSort('volumeRatio')">
                  Vol Ratio
                  <span class="sort-icon">{{ getSortIcon('volumeRatio') }}</span>
                </th>
                <th class="th-action"></th>
              </tr>
            </thead>
            <tbody>
              @for (item of state.sortedScoutingResults(); track item.symbol) {
                <tr 
                  class="scouter-row"
                  [class.signal-row]="item.shouldEnter"
                  [class.near-signal-row]="!item.shouldEnter && (item.confidence ?? 0) >= 40"
                  (click)="state.selectedAsset.set(item.symbol)"
                >
                  <!-- Asset -->
                  <td class="td-asset">
                    <div class="scouter-asset-info">
                      @if (!state.logoErrors().has(item.symbol)) {
                        <img 
                          [src]="state.getLogoUrl(item.symbol)" 
                          (error)="state.onLogoError(item.symbol)" 
                          class="scouter-logo" 
                          alt="" 
                        />
                      } @else {
                        <div class="scouter-logo fallback" [style.backgroundColor]="state.getLogoColor(item.symbol)">
                          {{ item.symbol.substring(0, 2) }}
                        </div>
                      }
                      <div class="asset-name-col">
                        <span class="scouter-symbol">{{ item.symbol }}</span>
                        @if (item.shouldEnter) {
                          <span class="entry-signal-indicator">🚀 ENTRY</span>
                        }
                      </div>
                    </div>
                  </td>

                  <!-- Price -->
                  <td class="td-price">\${{ item.price.toFixed(2) }}</td>

                  <!-- Confidence -->
                  <td class="td-confidence">
                    <div class="confidence-cell">
                      <div class="confidence-bar-track">
                        <div 
                          class="confidence-bar-fill"
                          [class.conf-low]="(item.confidence ?? 0) < 40"
                          [class.conf-mid]="(item.confidence ?? 0) >= 40 && (item.confidence ?? 0) < 70"
                          [class.conf-high]="(item.confidence ?? 0) >= 70"
                          [style.width.%]="item.confidence ?? 0"
                        ></div>
                      </div>
                      <span class="confidence-value">{{ item.confidence ?? 0 }}%</span>
                    </div>
                  </td>

                  <!-- Strategies -->
                  <td class="td-strategies">
                    <div class="strategy-pills">
                      @if (item.triggeredStrategies && item.triggeredStrategies.length > 0) {
                        @for (strat of item.triggeredStrategies; track strat) {
                          <span 
                            class="strategy-pill"
                            [class.pill-macd]="strat === 'MACD'"
                            [class.pill-rsi]="strat === 'RSI'"
                            [class.pill-volume]="strat === 'Volume'"
                          >{{ strat }}</span>
                        }
                      } @else {
                        <span class="strategy-pill pill-none">—</span>
                      }
                    </div>
                  </td>

                  <!-- RSI -->
                  <td class="td-rsi">
                    <span 
                      [class.rsi-oversold]="(item.rsi ?? 0) > 0 && (item.rsi ?? 0) < 30"
                      [class.rsi-overbought]="(item.rsi ?? 0) > 70"
                      [class.rsi-neutral]="(item.rsi ?? 0) >= 30 && (item.rsi ?? 0) <= 70"
                    >
                      {{ (item.rsi ?? 0) > 0 ? (item.rsi).toFixed(1) : '—' }}
                    </span>
                  </td>

                  <!-- MACD Histogram -->
                  <td class="td-hist">
                    <span 
                      [class.green]="(item.histogram ?? 0) > 0" 
                      [class.red]="(item.histogram ?? 0) < 0"
                    >
                      {{ item.histogram !== undefined ? item.histogram.toFixed(4) : '—' }}
                    </span>
                  </td>

                  <!-- Volume Ratio -->
                  <td class="td-vol">
                    <span 
                      [class.vol-spike]="(item.volumeRatio ?? 0) >= 2"
                      [class.vol-elevated]="(item.volumeRatio ?? 0) >= 1.5 && (item.volumeRatio ?? 0) < 2"
                    >
                      {{ (item.volumeRatio ?? 0) > 0 ? (item.volumeRatio).toFixed(1) + 'x' : '—' }}
                    </span>
                  </td>

                  <!-- Action -->
                  <td class="td-action">
                    <button class="view-chart-btn" (click)="onViewChart($event, item.symbol)">
                      View Chart →
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <div class="no-signals-state">
            <span class="no-signals-icon">📡</span>
            <p>Scouting in progress... Waiting for market data to evaluate strategies.</p>
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
    // Scroll to chart area
    const chartEl = document.querySelector('app-historical-chart');
    if (chartEl) {
      chartEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  getSortIcon(field: string): string {
    if (this.state.scoutingSortField() !== field) return '↕';
    return this.state.scoutingSortDir() === 'desc' ? '↓' : '↑';
  }
}
