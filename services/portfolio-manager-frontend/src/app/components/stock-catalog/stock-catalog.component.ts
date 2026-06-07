import { Component, inject, ChangeDetectionStrategy, signal, computed, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-stock-catalog',
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Desktop Sidebar View -->
    <aside 
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      [ngClass]="{
        'w-[320px]': isFullyExpanded(),
        'w-[72px]': !isFullyExpanded(),
        'absolute top-0 left-0 z-50 bg-[#141d24]/90 backdrop-blur-xl shadow-[0_25px_60px_rgba(0,0,0,0.65)] border-r border-slate-700/60 rounded-r-2xl overflow-visible': isFloating(),
        'relative z-20 bg-[#141d24]/90 overflow-hidden': !isFloating()
      }"
      class="hidden lg:flex flex-col h-[calc(100vh-40px)] border border-slate-800/80 transition-all duration-300 ease-out shrink-0 rounded-2xl"
    >
      <!-- Subtle glow indicator on collapsed sidebar -->
      @if (state.leftSidebarCollapsed() && !isHovered()) {
        <div class="absolute inset-y-4 right-0 w-px bg-gradient-to-b from-emerald-500/0 via-emerald-500/40 to-emerald-500/0 animate-pulse"></div>
      }

      <!-- Header Area -->
      <div 
        [ngClass]="isFullyExpanded() ? 'px-4 justify-between' : 'px-0 justify-center'"
        class="border-b border-slate-800/60 flex items-center bg-[#18232c]/50 h-[68px] transition-all duration-300 shrink-0"
      >
        <!-- Toggle button (Gmail style hamburger/menu) -->
        <button 
          (click)="toggleSidebar($event)"
          [ngClass]="isFullyExpanded() ? '' : 'mx-auto'"
          class="relative w-10 h-10 flex items-center justify-center rounded-xl bg-slate-850/80 hover:bg-slate-700/60 text-slate-200 hover:text-white border border-slate-700/60 hover:border-slate-500/50 transition-all duration-200 shrink-0 cursor-pointer shadow-md group"
          [title]="state.leftSidebarCollapsed() ? 'Expand and lock menu' : 'Collapse menu'"
        >
          <div class="relative w-5 h-5 flex items-center justify-center">
            <!-- Hamburger → Arrow animated icon -->
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 absolute transition-all duration-300" 
              [ngClass]="state.leftSidebarCollapsed() ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-75 -rotate-90'" 
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 absolute transition-all duration-300" 
              [ngClass]="!state.leftSidebarCollapsed() ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-75 rotate-90'" 
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </div>
          <!-- Toggle tooltip on floating menu -->
          @if (isFloating()) {
            <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 bg-slate-800 text-[10px] text-slate-300 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {{ state.leftSidebarCollapsed() ? 'Click to pin' : 'Collapse' }}
            </span>
          }
        </button>

        <!-- Expanded Header Content (Fades in) -->
        <div 
          class="flex items-center justify-between flex-1 min-w-0 transition-all duration-300 ml-3"
          [ngClass]="isFullyExpanded() ? 'opacity-100 translate-x-0 w-auto' : 'opacity-0 -translate-x-3 w-0 pointer-events-none overflow-hidden'"
        >
          <div class="flex items-center gap-2.5">
            <div class="w-1.5 h-6 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-full"></div>
            <h2 class="text-sm font-extrabold text-white tracking-wide">Stock Catalog</h2>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0 ml-2">
            {{ state.filteredAssets().length }}
          </span>
        </div>
      </div>

      <!-- Search Area -->
      <div 
        [ngClass]="isFullyExpanded() ? 'px-4' : 'px-0'"
        class="py-3 border-b border-slate-800/60 bg-[#162028]/30 flex items-center justify-center h-[53px] transition-all duration-300 shrink-0"
      >
        <div class="relative flex items-center w-full transition-all duration-300 justify-center">
          <button 
            (click)="focusSearchInput($event)"
            [ngClass]="isFullyExpanded() ? 'left-3 translate-x-0 w-5 h-5 bg-transparent border-0' : 'left-1/2 -translate-x-1/2 w-10 h-10 bg-[#0d131a] hover:bg-slate-700/50 border border-slate-700/50 rounded-xl shadow-inner'"
            class="absolute text-slate-300 hover:text-white flex items-center justify-center transition-all duration-300 cursor-pointer"
            title="Search stock tokens..."
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <input
            #searchInput
            type="text"
            placeholder="Search stock tokens..."
            [ngModel]="state.searchQuery()"
            (ngModelChange)="state.searchQuery.set($event)"
            [ngClass]="isFullyExpanded() ? 'w-full pl-9 pr-3 opacity-100' : 'w-0 pl-0 pr-0 opacity-0 pointer-events-none'"
            class="bg-[#0d131a] border border-slate-800/85 rounded-lg py-2 text-xs text-slate-100 placeholder-slate-400 transition-all duration-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/25 font-sans"
          />
        </div>
      </div>

      <!-- Sort Controls Bar (Only when expanded) -->
      <div 
        [ngClass]="isFullyExpanded() ? 'h-9 py-1.5 px-4 border-b border-slate-800/50 opacity-100 translate-y-0' : 'h-0 opacity-0 -translate-y-1 pointer-events-none overflow-hidden'"
        class="bg-[#121920]/40 flex items-center justify-between text-[10px] font-bold text-slate-400 transition-all duration-300 select-none shrink-0"
      >
        <span class="text-slate-500 uppercase tracking-wider text-[8px]">Sort By</span>
        <div class="flex items-center gap-1.5">
          <button 
            (click)="setSort('name')"
            [ngClass]="sortField() === 'name' ? 'bg-slate-800 text-emerald-400 border border-slate-700/85' : 'border border-transparent hover:bg-slate-800/45 text-slate-400 hover:text-slate-300'"
            class="px-1.5 py-0.5 rounded cursor-pointer transition-all duration-150 flex items-center gap-0.5"
          >
            Name
            @if (sortField() === 'name') {
              <span class="text-[9px]">{{ sortDir() === 'asc' ? '↑' : '↓' }}</span>
            }
          </button>
          <button 
            (click)="setSort('price')"
            [ngClass]="sortField() === 'price' ? 'bg-slate-800 text-emerald-400 border border-slate-700/85' : 'border border-transparent hover:bg-slate-800/45 text-slate-400 hover:text-slate-300'"
            class="px-1.5 py-0.5 rounded cursor-pointer transition-all duration-150 flex items-center gap-0.5"
          >
            Price
            @if (sortField() === 'price') {
              <span class="text-[9px]">{{ sortDir() === 'asc' ? '↑' : '↓' }}</span>
            }
          </button>
          <button 
            (click)="setSort('change')"
            [ngClass]="sortField() === 'change' ? 'bg-slate-800 text-emerald-400 border border-slate-700/85' : 'border border-transparent hover:bg-slate-800/45 text-slate-400 hover:text-slate-300'"
            class="px-1.5 py-0.5 rounded cursor-pointer transition-all duration-150 flex items-center gap-0.5"
          >
            Change
            @if (sortField() === 'change') {
              <span class="text-[9px]">{{ sortDir() === 'asc' ? '↑' : '↓' }}</span>
            }
          </button>
        </div>
      </div>

      <!-- Assets List -->
      <div 
        [ngClass]="isFullyExpanded() ? 'p-3 opacity-100' : 'px-0 py-3 opacity-100'"
        class="flex-1 overflow-y-auto space-y-1 custom-scrollbar bg-[#0f161c]/40 transition-all duration-300"
      >
        @if (state.isLoading()) {
          <div class="space-y-2 animate-pulse">
            @for (i of [1, 2, 3, 4, 5, 6, 7, 8]; track i) {
              <div 
                [ngClass]="isFullyExpanded() ? 'px-3 justify-between' : 'px-[15px] justify-center'"
                class="flex items-center py-2.5 rounded-lg border border-slate-800/40 bg-slate-900/30 transition-all duration-300 h-[48px]"
              >
                <div class="flex items-center gap-2.5 shrink-0">
                  <div class="w-9 h-9 rounded-full bg-slate-800/50 shrink-0"></div>
                  <div 
                    [ngClass]="isFullyExpanded() ? 'w-20 opacity-50' : 'w-0 opacity-0 pointer-events-none'"
                    class="h-3 rounded bg-slate-800/50 transition-all duration-300"
                  ></div>
                </div>
                <div 
                  [ngClass]="isFullyExpanded() ? 'w-12 mx-2 opacity-30' : 'w-0 opacity-0 pointer-events-none'"
                  class="h-3 rounded bg-slate-800/50 transition-all duration-300"
                ></div>
                <div 
                  [ngClass]="isFullyExpanded() ? 'w-16 opacity-40' : 'w-0 opacity-0 pointer-events-none'"
                  class="h-3 rounded bg-slate-800/50 transition-all duration-300"
                ></div>
              </div>
            }
          </div>
        } @else if (state.error()) {
          <div class="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 text-xs text-center px-4">
            @if (isFullyExpanded()) {
              <p class="text-rose-400">{{ state.error() }}</p>
              <button (click)="state.fetchAssets()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold transition-all">Retry</button>
            } @else {
              <button (click)="state.fetchAssets()" class="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-full text-xs font-bold transition-all" title="Retry">&#x21BB;</button>
            }
          </div>
        } @else {
          @for (asset of sortedAssets(); track asset) {
            @let changeInfo = getAssetChange(asset);
            @let isSelected = state.selectedAsset() === asset;
            <button
              (click)="state.selectAsset(asset)"
              [ngClass]="[
                isSelected 
                  ? 'bg-gradient-to-r from-emerald-500/12 to-transparent border-l-[2.5px] border-emerald-500 text-white font-bold shadow-[inset_0_0_20px_rgba(16,185,129,0.06)]' 
                  : 'border-l-[2.5px] border-transparent text-slate-300 hover:bg-slate-800/30 hover:text-white',
                isFullyExpanded() ? 'px-3' : 'px-[15px]'
              ]"
              class="w-full flex items-center py-2.5 rounded-r-lg transition-all duration-200 cursor-pointer text-left h-[48px] group"
              [title]="asset"
            >
              <!-- Left Section: Avatar (always visible) -->
              <div class="relative shrink-0 flex items-center justify-center" [ngClass]="isFullyExpanded() ? 'ml-0' : 'mx-auto'">
                <div 
                  [ngClass]="isSelected 
                    ? 'border-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.6)] scale-110' 
                    : 'border-slate-600/70 hover:border-slate-400 shadow-md group-hover:scale-105'"
                  class="w-[38px] h-[38px] flex items-center justify-center rounded-full overflow-hidden bg-slate-900 border-2 p-0.5 transition-all duration-300"
                >
                  @if (!state.logoErrors().has(asset)) {
                    <img [src]="state.getLogoUrl(asset)" (error)="state.onLogoError(asset)" class="w-full h-full rounded-full object-contain bg-white" alt="" />
                  } @else {
                    <div class="w-full h-full flex items-center justify-center text-[11px] font-bold text-white rounded-full" [style.background-color]="state.getLogoColor(asset)">
                      {{ asset.substring(0, 2) }}
                    </div>
                  }
                </div>
                <!-- Signal badge when collapsed (absolute over avatar) -->
                @if (state.hasScoutingSignal(asset) && !isFullyExpanded()) {
                  <span class="absolute -top-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-emerald-500 text-[8px] shadow-[0_0_10px_rgba(16,185,129,0.7)] z-10 border-2 border-[#141d24]">
                    🚀
                  </span>
                }
              </div>

              <!-- Expanded content container -->
              <div 
                [ngClass]="isFullyExpanded() ? 'opacity-100 translate-x-0 ml-2.5 w-auto' : 'opacity-0 -translate-x-2 w-0 pointer-events-none overflow-hidden ml-0'"
                class="flex items-center flex-1 min-w-0 transition-all duration-300 delay-75"
              >
                <!-- Name -->
                <span class="text-xs font-bold tracking-wide truncate shrink-0 max-w-[70px]">{{ asset }}</span>

                <!-- Sparkline -->
                <div class="h-5 w-10 flex items-end justify-center shrink-0 mx-1">
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

                <!-- Price / Pct / Signal -->
                <div class="flex items-center gap-1.5 shrink-0 ml-auto">
                  <div class="flex flex-col items-end text-right leading-tight">
                    <span class="text-xs font-bold text-white tabular-nums">{{ getAssetPrice(asset) }}</span>
                    <span [ngClass]="changeInfo.isPositive ? 'text-[#10b981]' : 'text-rose-500'" class="text-[11px] font-bold tabular-nums">
                      {{ changeInfo.val }}
                    </span>
                  </div>
                  @if (state.hasScoutingSignal(asset)) {
                    <div
                      class="w-[22px] h-[22px] flex items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] shrink-0 border border-emerald-500/20"
                      title="Active Entry Signal Detected"
                    >
                      🚀
                    </div>
                  } @else {
                    <div class="w-[22px] h-[22px] shrink-0"></div>
                  }
                </div>
              </div>
            </button>
          } @empty {
            <div class="flex flex-col items-center justify-center py-16 text-slate-400 text-xs">
              @if (isFullyExpanded()) {
                <p>No symbols match your search.</p>
              } @else {
                <p title="No symbols match">&#x2205;</p>
              }
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

          <!-- Mobile Sort Controls -->
          <div class="px-5 py-2.5 border-b border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400 bg-[#121920]/20 select-none">
            <span class="text-slate-500 uppercase tracking-wider text-[8px]">Sort By</span>
            <div class="flex items-center gap-1.5">
              <button 
                (click)="setSort('name')"
                [ngClass]="sortField() === 'name' ? 'bg-slate-800 text-emerald-400 border border-slate-700/80' : 'border border-transparent hover:bg-slate-800/40 text-slate-400'"
                class="px-2 py-0.5 rounded cursor-pointer transition-all duration-150"
              >
                Name {{ sortField() === 'name' ? (sortDir() === 'asc' ? '↑' : '↓') : '' }}
              </button>
              <button 
                (click)="setSort('price')"
                [ngClass]="sortField() === 'price' ? 'bg-slate-800 text-emerald-400 border border-slate-700/80' : 'border border-transparent hover:bg-slate-800/40 text-slate-400'"
                class="px-2 py-0.5 rounded cursor-pointer transition-all duration-150"
              >
                Price {{ sortField() === 'price' ? (sortDir() === 'asc' ? '↑' : '↓') : '' }}
              </button>
              <button 
                (click)="setSort('change')"
                [ngClass]="sortField() === 'change' ? 'bg-slate-800 text-emerald-400 border border-slate-700/80' : 'border border-transparent hover:bg-slate-800/40 text-slate-400'"
                class="px-2 py-0.5 rounded cursor-pointer transition-all duration-150"
              >
                Change {{ sortField() === 'change' ? (sortDir() === 'asc' ? '↑' : '↓') : '' }}
              </button>
            </div>
          </div>

          <!-- Scrollable assets -->
          <div class="flex-1 overflow-y-auto p-3 space-y-1.5 bg-[#0f161c]/40">
            @for (asset of sortedAssets(); track asset) {
              @let changeInfo = getAssetChange(asset);
              <div
                (click)="state.selectAsset(asset); state.mobileCatalogOpen.set(false)"
                [ngClass]="state.selectedAsset() === asset ? 'bg-emerald-500/10 text-white' : 'text-slate-300'"
                class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-transparent hover:bg-slate-850"
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
export class StockCatalogComponent implements OnDestroy {
  state = inject(StateService);
  isHovered = signal(false);
  isFullyExpanded = computed(() => !this.state.leftSidebarCollapsed() || this.isHovered());
  isFloating = computed(() => this.state.leftSidebarCollapsed() && this.isHovered());

  sortField = signal<'name' | 'price' | 'change'>('name');
  sortDir = signal<'asc' | 'desc'>('asc');

  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  onMouseEnter() {
    if (!this.state.leftSidebarCollapsed()) return;
    if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
    this.hoverTimeout = setTimeout(() => this.isHovered.set(true), 120);
  }

  onMouseLeave() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    this.isHovered.set(false);
  }

  ngOnDestroy() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
  }

  focusSearchInput(event: MouseEvent) {
    event.stopPropagation();
    if (!this.isFullyExpanded()) {
      this.isHovered.set(true);
      setTimeout(() => this.searchInput?.nativeElement?.focus(), 150);
    } else {
      this.searchInput?.nativeElement?.focus();
    }
  }

  toggleSidebar(event: MouseEvent) {
    event.stopPropagation();
    this.state.leftSidebarCollapsed.set(!this.state.leftSidebarCollapsed());
  }

  setSort(field: 'name' | 'price' | 'change') {
    if (this.sortField() === field) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set(field === 'name' ? 'asc' : 'desc');
    }
  }

  getNumericPrice(symbol: string): number {
    const scout = this.state.scoutingResults().find(r => r.symbol === symbol);
    if (scout && scout.price) return scout.price;
    const mom = this.state.momentumStocks().find(r => r.symbol === symbol);
    if (mom && mom.price) return mom.price;
    
    // Deterministic price based on symbol
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs((hash % 890) + 10) + 0.45;
  }

  getNumericChange(symbol: string): number {
    const scout = this.state.scoutingResults().find(r => r.symbol === symbol);
    if (scout && scout.changePct !== undefined) return scout.changePct;
    const mom = this.state.momentumStocks().find(r => r.symbol === symbol);
    if (mom && mom.changePct !== undefined) return mom.changePct;
    
    // Deterministic percent change
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
    }
    return ((hash % 100) / 10);
  }

  getAssetPrice(symbol: string): string {
    return `$${this.getNumericPrice(symbol).toFixed(2)}`;
  }

  getAssetChange(symbol: string): { val: string, isPositive: boolean } {
    const change = this.getNumericChange(symbol);
    return {
      val: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
      isPositive: change >= 0
    };
  }

  sortedAssets = computed(() => {
    const assets = [...this.state.filteredAssets()];
    const field = this.sortField();
    const dir = this.sortDir();

    assets.sort((a, b) => {
      let comparison = 0;
      if (field === 'name') {
        comparison = a.localeCompare(b);
      } else if (field === 'price') {
        comparison = this.getNumericPrice(a) - this.getNumericPrice(b);
      } else if (field === 'change') {
        comparison = this.getNumericChange(a) - this.getNumericChange(b);
      }
      return dir === 'asc' ? comparison : -comparison;
    });

    return assets;
  });

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
