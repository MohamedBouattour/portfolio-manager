import { Component, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-manual-order-modal',
  imports: [CommonModule, FormsModule],
  template: `
    @if (state.showOrderModal()) {
      <!-- Backdrop blur overlay -->
      <div 
        (click)="state.closeOrderModal()"
        class="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 px-3 animate-fade-in"
      >
        <!-- Modal Container -->
        <div 
          (click)="$event.stopPropagation()"
          class="bg-[#141d24] border border-amber-500/35 rounded-2xl w-full max-w-md shadow-[0_24px_50px_-12px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden animate-scale-up"
        >
          <!-- Header -->
          <div class="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-[#18232c]/50">
            <h3 class="text-sm font-extrabold text-amber-400 tracking-wide flex items-center gap-1.5">
              <span>⚡</span> Manual Order Execution
            </h3>
            <button 
              (click)="state.closeOrderModal()"
              class="bg-transparent border-none text-slate-400 hover:text-white text-2xl cursor-pointer leading-none transition-colors"
            >
              &times;
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 space-y-4 font-sans text-xs">
            
            <!-- Symbol (disabled) -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold text-slate-400 uppercase tracking-wide">Symbol</label>
              <input 
                type="text" 
                [value]="state.modalSymbol()" 
                disabled 
                class="w-full bg-[#0d131a] border border-slate-800 rounded-lg px-3 py-2.5 font-extrabold text-sky-400 cursor-not-allowed select-none" 
              />
            </div>

            <!-- Side and Leverage Row -->
            <div class="flex gap-4">
              <div class="flex-1 flex flex-col gap-1.5">
                <label class="text-xs font-bold text-slate-400 uppercase tracking-wide">Side (Action)</label>
                <select 
                  [ngModel]="state.modalSide()" 
                  (ngModelChange)="state.modalSide.set($event)"
                  class="w-full bg-[#0d131a] border border-slate-800 rounded-lg px-3 py-2.5 font-bold text-slate-100 outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="Buy">BUY (Long)</option>
                  <option value="Sell">SELL (Short)</option>
                </select>
              </div>
              
              <div class="flex-1 flex flex-col gap-1.5">
                <label class="text-xs font-bold text-slate-400 uppercase tracking-wide">Leverage</label>
                <input 
                  type="number" 
                  [ngModel]="state.modalLeverage()" 
                  (ngModelChange)="state.modalLeverage.set(+$event)"
                  class="w-full bg-[#0d131a] border border-slate-800 rounded-lg px-3 py-2.5 font-bold text-slate-100 outline-none focus:border-amber-400 font-mono" 
                  min="1" 
                  max="100" 
                />
              </div>
            </div>

            <!-- Size and Margin Row -->
            <div class="flex gap-4">
              <div class="flex-1 flex flex-col gap-1.5">
                <label class="text-xs font-bold text-slate-400 uppercase tracking-wide">Quantity (Units)</label>
                <input 
                  type="number" 
                  [ngModel]="state.modalQty()" 
                  (ngModelChange)="onQtyChange(+$event)"
                  class="w-full bg-[#0d131a] border border-slate-800 rounded-lg px-3 py-2.5 font-bold text-slate-100 outline-none focus:border-amber-400 font-mono" 
                  min="0.001" 
                  step="0.01" 
                />
              </div>
              
              <div class="flex-1 flex flex-col gap-1.5">
                <label class="text-xs font-bold text-slate-400 uppercase tracking-wide">Margin Size ($)</label>
                <input 
                  type="number" 
                  [ngModel]="state.modalMargin()" 
                  (ngModelChange)="onMarginChange(+$event)"
                  class="w-full bg-[#0d131a] border border-slate-800 rounded-lg px-3 py-2.5 font-bold text-slate-100 outline-none focus:border-amber-400 font-mono" 
                  min="0.01" 
                  step="0.01" 
                />
              </div>
            </div>

            <!-- Reduce Only -->
            <div class="flex items-center">
              <label class="flex items-center gap-2 text-slate-400 font-bold cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  [ngModel]="state.modalReduceOnly()" 
                  (ngModelChange)="state.modalReduceOnly.set($event)"
                  class="w-4 h-4 rounded border-slate-800 bg-[#0d131a] text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer" 
                />
                Reduce Only
              </label>
            </div>

            <!-- Cost Summary Block -->
            <div class="bg-[#0d131a] border border-slate-850 rounded-xl p-4 space-y-3">
              <div class="text-xs font-extrabold uppercase text-slate-400 tracking-wider">Order Cost Summary</div>
              
              <div class="grid grid-cols-3 gap-3 font-mono text-center">
                <div class="flex flex-col gap-0.5">
                  <span class="text-xs font-bold text-slate-450 uppercase">Index Price</span>
                  <span class="text-xs font-bold text-slate-200">\${{ state.modalAssetPrice().toFixed(2) }}</span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span class="text-xs font-bold text-slate-450 uppercase">Value Size</span>
                  <span class="text-xs font-bold text-slate-200">\${{ state.modalNotional().toFixed(2) }}</span>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span class="text-xs font-bold text-slate-450 uppercase">Margin Cost</span>
                  <span class="text-xs font-extrabold text-amber-400">\${{ state.modalMargin().toFixed(2) }}</span>
                </div>
              </div>
            </div>

            <!-- Portfolio Allocation Block -->
            <div class="bg-[#0d131a] border border-slate-850 rounded-xl p-4 space-y-2">
              <div class="flex justify-between items-center text-xs font-extrabold uppercase text-slate-400 tracking-wider">
                <span>Portfolio Allocation</span>
                <span class="text-[10px] text-slate-500 font-bold normal-case">Of Total Equity (\${{ state.equity().toFixed(2) }})</span>
              </div>
              <div class="flex items-center gap-3 font-mono text-xs">
                <div class="flex-1 flex flex-col gap-0.5">
                  <span class="text-[10px] font-bold text-slate-450 uppercase">Before Order</span>
                  <span class="text-xs font-bold text-slate-200">{{ ratioBefore().toFixed(2) }}%</span>
                </div>
                <div class="text-slate-650 text-sm">➔</div>
                <div class="flex-1 flex flex-col gap-0.5">
                  <span class="text-[10px] font-bold text-slate-450 uppercase">After Order</span>
                  <span class="text-xs font-bold text-amber-400">{{ ratioAfter().toFixed(2) }}%</span>
                </div>
              </div>
              
              <!-- Allocation visual progress bar -->
              <div class="relative w-full h-1.5 bg-slate-950/80 rounded-full overflow-hidden flex border border-slate-900 mt-1">
                @if (ratioAfter() > ratioBefore()) {
                  <!-- Existing portion -->
                  <div class="h-full bg-slate-600 transition-all duration-300" [style.width.%]="Math.min(ratioBefore(), 100)"></div>
                  <!-- Added portion -->
                  <div class="h-full bg-amber-500 transition-all duration-300" [style.width.%]="Math.min(ratioAfter() - ratioBefore(), 100 - ratioBefore())"></div>
                } @else if (ratioAfter() < ratioBefore()) {
                  <!-- Remaining portion -->
                  <div class="h-full bg-slate-600 transition-all duration-300" [style.width.%]="Math.min(ratioAfter(), 100)"></div>
                  <!-- Reduced portion -->
                  <div class="h-full bg-rose-500/50 transition-all duration-300" [style.width.%]="Math.min(ratioBefore() - ratioAfter(), 100 - ratioAfter())"></div>
                } @else {
                  <!-- Equal portion -->
                  <div class="h-full bg-slate-600 transition-all duration-300" [style.width.%]="Math.min(ratioBefore(), 100)"></div>
                }
              </div>
            </div>

            <!-- Reason / Notes -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold text-slate-400 uppercase tracking-wide">Execution Reason</label>
              <input 
                type="text" 
                [ngModel]="state.modalReason()" 
                (ngModelChange)="state.modalReason.set($event)"
                class="w-full bg-[#0d131a] border border-slate-800 rounded-lg px-3 py-2.5 font-bold text-slate-100 outline-none focus:border-amber-400 placeholder-slate-600" 
                placeholder="e.g. Manual Override" 
              />
            </div>
          </div>

          <!-- Actions Footer -->
          <div class="px-5 py-4 border-t border-slate-800 flex justify-end gap-3 bg-[#0d131a]/40">
            <button 
              (click)="state.closeOrderModal()" 
              class="px-4 py-2 border border-slate-800 hover:border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold rounded-lg cursor-pointer transition-all"
            >
              Cancel
            </button>
            
            <button 
              (click)="state.executeModalOrder()" 
              [disabled]="state.orderExecuting() || state.modalQty() <= 0" 
              class="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold rounded-lg shadow-[0_4px_16px_rgba(245,158,11,0.25)] hover:-translate-y-0.5 transition-all disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer flex items-center gap-1.5"
            >
              @if (state.orderExecuting()) {
                <span class="spinner !w-3.5 !h-3.5 !border-slate-950/20 !border-t-slate-950 inline-block"></span>
                <span>Executing...</span>
              } @else {
                <span>🚀 Execute Market Order</span>
              }
            </button>
          </div>

          <!-- Status logs -->
          @if (state.orderStatus(); as status) {
            <div
              [ngClass]="status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-t border-emerald-500/20' : status.startsWith('error') ? 'bg-rose-500/10 text-rose-400 border-t border-rose-500/20' : ''"
              class="px-5 py-2.5 text-center font-bold font-sans text-xs tracking-wide"
            >
              {{ status === 'success' ? 'Order executed successfully!' : status.toUpperCase() }}
            </div>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ManualOrderModalComponent {
  state = inject(StateService);
  Math = Math;

  existingPosition = computed(() => {
    const symbol = this.state.modalSymbol();
    return this.state.openPositions().find(p => p.symbol === symbol) || null;
  });

  ratioBefore = computed(() => {
    const equity = this.state.equity();
    if (equity <= 0) return 0;
    const pos = this.existingPosition();
    const valBefore = pos ? pos.positionValue : 0;
    return (valBefore / equity) * 100;
  });

  ratioAfter = computed(() => {
    const equity = this.state.equity();
    if (equity <= 0) return 0;

    const symbol = this.state.modalSymbol();
    const price = this.state.modalAssetPrice();
    const orderQty = this.state.modalQty();
    const orderSide = this.state.modalSide();

    const pos = this.existingPosition();
    let currentSignedQty = 0;
    if (pos) {
      currentSignedQty = pos.side === 'Buy' ? pos.size : -pos.size;
    }

    const orderSignedQty = orderSide === 'Buy' ? orderQty : -orderQty;
    const newSignedQty = currentSignedQty + orderSignedQty;
    const valAfter = Math.abs(newSignedQty * price);

    return (valAfter / equity) * 100;
  });

  onQtyChange(qty: number) {
    if (isNaN(qty) || qty <= 0) {
      this.state.modalQty.set(0);
      return;
    }
    this.state.modalQty.set(qty);
  }

  onMarginChange(margin: number) {
    if (isNaN(margin) || margin <= 0) {
      this.state.modalQty.set(0);
      return;
    }
    const price = this.state.modalAssetPrice();
    const leverage = this.state.modalLeverage();
    if (price > 0 && leverage > 0) {
      const qty = (margin * leverage) / price;
      this.state.modalQty.set(parseFloat(qty.toFixed(4)));
    }
  }
}
