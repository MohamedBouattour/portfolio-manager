import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-stock-catalog',
  imports: [CommonModule, FormsModule],
  template: `
    <aside class="card">
      <div class="card-header cursor-pointer select-none" (click)="isCollapsed.set(!isCollapsed())">
        <h2 class="text-sm font-semibold text-slate-100">Stock Catalog</h2>
        <div class="flex items-center gap-2.5">
          <span class="badge bg-blue-500/15 text-blue-400 border-blue-500/30">{{ state.filteredAssets().length }} Assets</span>
          <span class="text-xs text-slate-400 transition-transform duration-200" [class.rotate-180]="!isCollapsed()">&#x25BC;</span>
        </div>
      </div>

      @if (!isCollapsed()) {
        <div class="px-4 py-3 border-b border-slate-700/30">
          <input
            type="text"
            placeholder="Search stock tokens..."
            [ngModel]="state.searchQuery()"
            (ngModelChange)="state.searchQuery.set($event)"
            class="form-input text-xs"
          />
        </div>

        <div class="flex-1 overflow-y-auto p-2.5 space-y-1 max-h-[65vh] lg:max-h-[70vh]">
          @if (state.isLoading()) {
            <div class="flex flex-col items-center justify-center py-10 text-slate-400 gap-3 text-xs">
              <span class="spinner"></span>
              <p>Loading catalog...</p>
            </div>
          } @else if (state.error()) {
            <div class="flex flex-col items-center justify-center py-10 text-slate-400 gap-3 text-xs">
              <p>{{ state.error() }}</p>
              <button (click)="state.fetchAssets()" class="btn btn-secondary btn-small">Retry</button>
            </div>
          } @else {
            @for (asset of state.filteredAssets(); track asset) {
              <button
                (click)="state.selectAsset(asset)"
                [ngClass]="state.selectedAsset() === asset ? 'bg-gradient-to-r from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/30 font-bold' : ''"
                class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-transparent text-slate-400 text-xs font-medium text-left cursor-pointer transition-all duration-200 hover:bg-slate-700/30 hover:text-slate-100"
              >
                <div class="w-6 h-6 flex items-center justify-center rounded-full overflow-hidden shrink-0">
                  @if (!state.logoErrors().has(asset)) {
                    <img [src]="state.getLogoUrl(asset)" (error)="state.onLogoError(asset)" class="w-full h-full rounded-full bg-white object-contain p-0.5" alt="" />
                  } @else {
                    <div class="w-full h-full flex items-center justify-center text-[10px] font-bold text-white rounded-full" [style.background-color]="state.getLogoColor(asset)">
                      {{ asset.substring(0, 2) }}
                    </div>
                  }
                </div>
                <span class="flex-1">{{ asset }}</span>
                @if (state.hasScoutingSignal(asset)) {
                  <span class="text-xs" title="Active LONG ENTRY signal!">&#x1F680;</span>
                }
                <span class="text-xs opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-1">&#x2192;</span>
              </button>
            } @empty {
              <div class="flex flex-col items-center justify-center py-10 text-slate-400 text-xs">
                <p>No symbols match your search.</p>
              </div>
            }
          }
        </div>
      }
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StockCatalogComponent {
  state = inject(StateService);
  isCollapsed = signal(true);
}
