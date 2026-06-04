import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-stock-catalog',
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Desktop Sidebar View -->
    <aside class="hidden lg:flex flex-col w-[320px] bg-[#141d24]/90 border border-slate-800/80 rounded-2xl h-[calc(100vh-40px)] overflow-hidden shadow-2xl shrink-0">
      <div class="p-5 border-b border-slate-800/60 flex justify-between items-center bg-[#18232c]/50">
        <h2 class="text-base font-extrabold text-white tracking-wide">Stock Catalog</h2>
        <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
          {{ state.filteredAssets().length }} Assets
        </span>
      </div>

      <div class="px-4 py-3 border-b border-slate-800/60 bg-[#162028]/30">
        <div class="relative flex items-center">
          <span class="absolute left-3 text-slate-400 text-sm">&#x1F50D;</span>
          <input
            type="text"
            placeholder="Search stock tokens..."
            [ngModel]="state.searchQuery()"
            (ngModelChange)="state.searchQuery.set($event)"
            class="w-full bg-[#0d131a] border border-slate-800/80 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/25 font-sans"
          />
        </div>
      </div>

      <!-- Assets List -->
      <div class="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar bg-[#0f161c]/40">
        @if (state.isLoading()) {
          <div class="space-y-3 animate-pulse">
            @for (i of [1, 2, 3, 4, 5, 6, 7, 8]; track i) {
              <div class="flex items-center justify-between p-2.5 rounded-lg border border-slate-800/40 bg-slate-900/30">
                <div class="flex items-center gap-2.5 w-[50%]">
                  <div class="w-7 h-7 rounded-full skeleton-shimmer shrink-0 opacity-40"></div>
                  <div class="h-3 w-16 rounded skeleton-shimmer opacity-50"></div>
                </div>
                <div class="w-10 h-3 rounded skeleton-shimmer mx-1 opacity-20"></div>
                <div class="flex items-center gap-2">
                  <div class="flex flex-col items-end gap-1.5">
                    <div class="h-3 w-12 rounded skeleton-shimmer opacity-50"></div>
                    <div class="h-2 w-8 rounded skeleton-shimmer opacity-30"></div>
                  </div>
                  <div class="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 skeleton-shimmer opacity-20"></div>
                </div>
              </div>
            }
          </div>
        } @else if (state.error()) {
          <div class="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 text-xs text-center px-4">
            <p class="text-rose-400">{{ state.error() }}</p>
            <button (click)="state.fetchAssets()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold transition-all">Retry</button>
          </div>
        } @else {
          @for (asset of state.filteredAssets(); track asset) {
            @let changeInfo = getAssetChange(asset);
            @let isSelected = state.selectedAsset() === asset;
            <button
              (click)="state.selectAsset(asset)"
              [ngClass]="isSelected ? 'bg-gradient-to-r from-emerald-500/10 to-transparent border-l-2 border-emerald-500 text-white' : 'border-l-2 border-transparent text-slate-300 hover:bg-slate-800/30 hover:text-white'"
              class="w-full flex items-center justify-between px-3 py-2.5 rounded-r-lg transition-all duration-250 cursor-pointer text-left"
            >
              <!-- Left Section: Avatar + Name -->
              <div class="flex items-center gap-2.5 max-w-[45%]">
                <div class="w-7 h-7 flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-slate-900 border border-white/5 p-0.5 shadow-inner">
                  @if (!state.logoErrors().has(asset)) {
                    <img [src]="state.getLogoUrl(asset)" (error)="state.onLogoError(asset)" class="w-full h-full rounded-full object-contain bg-white" alt="" />
                  } @else {
                    <div class="w-full h-full flex items-center justify-center text-xs font-bold text-white rounded-full" [style.background-color]="state.getLogoColor(asset)">
                      {{ asset.substring(0, 2) }}
                    </div>
                  }
                </div>
                <span class="text-xs font-bold tracking-wide truncate">{{ asset }}</span>
              </div>

              <!-- Middle Section: Sparkline -->
              <div class="w-10 h-5 flex items-end justify-center overflow-hidden shrink-0 mx-1">
                <svg class="w-full h-full overflow-visible" viewBox="0 0 40 20">
                  <path
                    [attr.d]="getSparklinePath(asset, changeInfo.isPositive)"
                    fill="none"
                    [attr.stroke]="changeInfo.isPositive ? '#10b981' : '#f43f5e'"
                    stroke-width="1.2"
                    stroke-linecap="round"
                  />
                </svg>
              </div>

              <!-- Right Section: Price / Pct / Signal -->
              <div class="flex items-center gap-2">
                <div class="flex flex-col items-end text-right">
                  <span class="text-xs font-bold text-white tabular-nums">{{ getAssetPrice(asset) }}</span>
                  <span [ngClass]="changeInfo.isPositive ? 'text-[#10b981]' : 'text-rose-500'" class="text-xs font-bold tabular-nums">
                    {{ changeInfo.val }}
                  </span>
                </div>
                <!-- Rocket Signal Button -->
                @if (state.hasScoutingSignal(asset)) {
                  <div
                    class="w-6 h-6 flex items-center justify-center rounded-lg bg-emerald-500 text-slate-950 shadow-[0_0_8px_#10b981] text-xs shrink-0"
                    title="Active Entry Signal Detected"
                  >
                    🚀
                  </div>
                } @else {
                  <div class="w-6 h-6 shrink-0"></div>
                }
              </div>
            </button>
          } @empty {
            <div class="flex flex-col items-center justify-center py-16 text-slate-400 text-xs">
              <p>No symbols match your search.</p>
            </div>
          }
        }
      </div>
    </aside>

    <!-- Mobile Stock Catalog Toggle Bar & Modal Overlay -->
    @if (state.mobileCatalogOpen()) {
      <div class="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-md flex flex-col justify-end lg:hidden" (click)="state.mobileCatalogOpen.set(false)">
        <div class="bg-[#141d24] border-t border-slate-800 rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden" (click)="$event.stopPropagation()">
          
          <!-- Bottom sheet header -->
          <div class="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-[#18232c]">
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
              <h2 class="text-sm font-extrabold text-white tracking-wide">Stock Catalog</h2>
            </div>
            <button (click)="state.mobileCatalogOpen.set(false)" class="text-slate-400 text-lg hover:text-white">&times;</button>
          </div>

          <!-- Search -->
          <div class="px-5 py-3 border-b border-slate-800 bg-[#162028]/40">
            <input
              type="text"
              placeholder="Search stock tokens..."
              [ngModel]="state.searchQuery()"
              (ngModelChange)="state.searchQuery.set($event)"
              class="w-full bg-[#0d131a] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <!-- Scrollable assets -->
          <div class="flex-1 overflow-y-auto p-3 space-y-1.5 bg-[#0f161c]/40">
            @for (asset of state.filteredAssets(); track asset) {
              @let changeInfo = getAssetChange(asset);
              <div
                (click)="state.selectAsset(asset); state.mobileCatalogOpen.set(false)"
                [ngClass]="state.selectedAsset() === asset ? 'bg-emerald-500/10 text-white' : 'text-slate-300'"
                class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-transparent hover:bg-slate-800/30"
              >
                <div class="flex items-center gap-2.5">
                  <div class="w-7 h-7 flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-slate-900 border border-white/5 p-0.5">
                    @if (!state.logoErrors().has(asset)) {
                      <img [src]="state.getLogoUrl(asset)" (error)="state.onLogoError(asset)" class="w-full h-full rounded-full object-contain bg-white" alt="" />
                    } @else {
                      <div class="w-full h-full flex items-center justify-center text-xs font-bold text-white rounded-full" [style.background-color]="state.getLogoColor(asset)">
                        {{ asset.substring(0, 2) }}
                      </div>
                    }
                  </div>
                  <span class="text-xs font-bold">{{ asset }}</span>
                </div>

                <div class="flex items-center gap-3">
                  <div class="flex flex-col items-end text-right">
                    <span class="text-xs font-bold text-white">{{ getAssetPrice(asset) }}</span>
                    <span [ngClass]="changeInfo.isPositive ? 'text-[#10b981]' : 'text-rose-500'" class="text-xs font-bold">
                      {{ changeInfo.val }}
                    </span>
                  </div>
                  @if (state.hasScoutingSignal(asset)) {
                    <div
                      class="w-6 h-6 flex items-center justify-center rounded-lg bg-emerald-500 text-slate-950 shadow-[0_0_8px_#10b981] text-xs shrink-0"
                      title="Active Entry Signal Detected"
                    >
                      🚀
                    </div>
                  } @else {
                    <div class="w-6 h-6 shrink-0"></div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StockCatalogComponent {
  state = inject(StateService);

  getAssetPrice(symbol: string): string {
    const scout = this.state.scoutingResults().find(r => r.symbol === symbol);
    if (scout && scout.price) return `$${scout.price.toFixed(2)}`;
    const mom = this.state.momentumStocks().find(r => r.symbol === symbol);
    if (mom && mom.price) return `$${mom.price.toFixed(2)}`;
    
    // Deterministic price based on symbol
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
    }
    const price = Math.abs((hash % 890) + 10) + 0.45;
    return `$${price.toFixed(2)}`;
  }

  getAssetChange(symbol: string): { val: string, isPositive: boolean } {
    const scout = this.state.scoutingResults().find(r => r.symbol === symbol);
    if (scout && scout.changePct !== undefined) {
      return {
        val: `${scout.changePct >= 0 ? '+' : ''}${scout.changePct.toFixed(2)}%`,
        isPositive: scout.changePct >= 0
      };
    }
    const mom = this.state.momentumStocks().find(r => r.symbol === symbol);
    if (mom && mom.changePct !== undefined) {
      return {
        val: `${mom.changePct >= 0 ? '+' : ''}${mom.changePct.toFixed(2)}%`,
        isPositive: mom.changePct >= 0
      };
    }
    
    // Deterministic percent change
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
    }
    const val = ((hash % 100) / 10);
    return {
      val: `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`,
      isPositive: val >= 0
    };
  }

  getSparklinePath(symbol: string, isPositive: boolean): string {
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
    }
    const points: number[] = [];
    for (let i = 0; i < 6; i++) {
      points.push(Math.abs((hash >> (i * 3)) % 12) + 4);
    }
    // Trend alignment
    if (isPositive) {
      points[0] = Math.max(points[0], 12);
      points[5] = Math.min(points[5], 4);
    } else {
      points[0] = Math.min(points[0], 4);
      points[5] = Math.max(points[5], 12);
    }
    let path = `M 0 ${points[0]}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${i * 8} ${points[i]}`;
    }
    return path;
  }
}
