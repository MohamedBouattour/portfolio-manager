import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-momentum-ticker',
  imports: [CommonModule],
  template: `
    @if (state.momentumStocks().length > 0) {
      <div class="momentum-ticker">
        <div class="ticker-label">
          <span class="pulse"></span>
          <span class="ticker-title">WEEKLY MOMENTUM LEADERBOARD</span>
        </div>
        <div class="ticker-track">
          <div class="ticker-content">
            @for (item of state.momentumStocks(); track item.symbol) {
              <div class="ticker-item" (click)="state.selectAsset(item.symbol)" title="Click to view chart">
                <div class="ticker-logo-container">
                  @if (!state.logoErrors().has(item.symbol)) {
                    <img 
                      [src]="state.getLogoUrl(item.symbol)" 
                      (error)="state.onLogoError(item.symbol)" 
                      class="ticker-company-logo" 
                      alt=""
                    />
                  } @else {
                    <div class="ticker-logo" [style.background-color]="state.getLogoColor(item.symbol)">
                      {{ item.symbol.substring(0, 2) }}
                    </div>
                  }
                </div>
                <span class="ticker-symbol">{{ item.symbol }}</span>
                <span class="ticker-price">\${{ item.price.toFixed(2) }}</span>
                <span class="ticker-pct">+{{ item.changePct.toFixed(1) }}%</span>
              </div>
            }
            <!-- Duplicate loop for seamless infinite scroll animation -->
            @for (item of state.momentumStocks(); track 'dup_' + item.symbol) {
              <div class="ticker-item" (click)="state.selectAsset(item.symbol)" title="Click to view chart">
                <div class="ticker-logo-container">
                  @if (!state.logoErrors().has(item.symbol)) {
                    <img 
                      [src]="state.getLogoUrl(item.symbol)" 
                      (error)="state.onLogoError(item.symbol)" 
                      class="ticker-company-logo" 
                      alt=""
                    />
                  } @else {
                    <div class="ticker-logo" [style.background-color]="state.getLogoColor(item.symbol)">
                      {{ item.symbol.substring(0, 2) }}
                    </div>
                  }
                </div>
                <span class="ticker-symbol">{{ item.symbol }}</span>
                <span class="ticker-price">\${{ item.price.toFixed(2) }}</span>
                <span class="ticker-pct">+{{ item.changePct.toFixed(1) }}%</span>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MomentumTickerComponent {
  state = inject(StateService);
}
