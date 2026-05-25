import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-uptrend-scouter',
  imports: [CommonModule],
  template: `
    <div class="card potential-uptrends-card">
      <div class="card-header">
        <div class="flex-row align-center gap-10">
          <h3>🚀 Potential Uptrend Assets (Active Entry Signals)</h3>
          <div class="timeframe-select-container">
            <span class="label">Timeframe:</span>
            <select 
              [value]="state.timeframe()" 
              (change)="onTimeframeChange($any($event.target).value)"
              class="timeframe-select"
            >
              <option value="1h">1h (60m)</option>
              <option value="4h">4h (240m)</option>
              <option value="1D">1D (Daily)</option>
            </select>
          </div>
        </div>
        <span class="scout-badge">
          Scouting {{ state.scoutingResults().length }} Assets
        </span>
      </div>
      <div class="scouting-card-body">
        @if (state.getUptrendAssets().length > 0) {
          <div class="uptrends-list">
            @for (item of state.getUptrendAssets(); track item.symbol) {
              <div class="uptrend-item" (click)="state.selectedAsset.set(item.symbol)">
                <div class="uptrend-symbol-info">
                  @if (!state.logoErrors().has(item.symbol)) {
                    <img 
                      [src]="state.getLogoUrl(item.symbol)" 
                      (error)="state.onLogoError(item.symbol)" 
                      class="uptrend-logo" 
                      alt="" 
                    />
                  } @else {
                    <div class="uptrend-logo fallback" [style.backgroundColor]="state.getLogoColor(item.symbol)">
                      {{ item.symbol.substring(0, 2) }}
                    </div>
                  }
                  <span class="symbol-name">{{ item.symbol }}</span>
                </div>
                <div class="uptrend-stats">
                  <div class="stat">
                    <span class="lbl">Price:</span>
                    <span class="val">\${{ item.price.toFixed(2) }}</span>
                  </div>
                  <div class="stat">
                    <span class="lbl">MACD:</span>
                    <span 
                      class="val" 
                      [class.green]="item.macd > 0" 
                      [class.red]="item.macd < 0"
                    >
                      {{ item.macd.toFixed(4) }}
                    </span>
                  </div>
                  <div class="stat">
                    <span class="lbl">Hist:</span>
                    <span 
                      class="val" 
                      [class.green]="item.histogram > 0" 
                      [class.red]="item.histogram < 0"
                    >
                      {{ item.histogram.toFixed(4) }}
                    </span>
                  </div>
                </div>
                <button class="view-chart-btn">View Chart →</button>
              </div>
            }
          </div>
        } @else {
          <div class="no-signals-state">
            <span class="no-signals-icon">💤</span>
            <p>No active bullish MACD entry signals scouted at this moment. The market is consolidating or in a downtrend.</p>
          </div>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UptrendScouterComponent {
  state = inject(StateService);

  onTimeframeChange(tf: string) {
    this.state.updateTimeframe(tf);
  }
}
