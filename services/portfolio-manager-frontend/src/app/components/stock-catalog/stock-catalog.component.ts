import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-stock-catalog',
  imports: [CommonModule, FormsModule],
  template: `
    <aside class="sidebar card">
      <div class="card-header">
        <h2>Stock Catalog</h2>
        <span class="badge">{{ state.filteredAssets().length }} Assets</span>
      </div>
      
      <div class="search-box">
        <input 
          type="text" 
          placeholder="Search stock tokens..." 
          [ngModel]="state.searchQuery()" 
          (ngModelChange)="state.searchQuery.set($event)"
          class="input-search"
        />
      </div>

      <div class="asset-list">
        @if (state.isLoading()) {
          <div class="loading-state">
            <span class="spinner"></span>
            <p>Loading catalog...</p>
          </div>
        } @else if (state.error()) {
          <div class="error-state">
            <p>{{ state.error() }}</p>
            <button (click)="state.fetchAssets()" class="btn btn-secondary">Retry</button>
          </div>
        } @else {
          @for (asset of state.filteredAssets(); track asset) {
            <button 
              (click)="state.selectAsset(asset)" 
              [class.active]="state.selectedAsset() === asset"
              class="asset-item"
            >
              <div class="asset-logo-container">
                @if (!state.logoErrors().has(asset)) {
                  <img 
                    [src]="state.getLogoUrl(asset)" 
                    (error)="state.onLogoError(asset)" 
                    class="asset-company-logo"
                    alt=""
                  />
                } @else {
                  <div class="asset-initials-logo" [style.background-color]="state.getLogoColor(asset)">
                    {{ asset.substring(0, 2) }}
                  </div>
                }
              </div>
              <span class="symbol-code">{{ asset }}</span>
              @if (state.hasScoutingSignal(asset)) {
                <span class="sidebar-signal-badge" title="Active LONG ENTRY signal!">🚀</span>
              }
              <span class="arrow">→</span>
            </button>
          } @empty {
            <div class="empty-state">
              <p>No symbols match your search.</p>
            </div>
          }
        }
      </div>
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StockCatalogComponent {
  state = inject(StateService);
}
