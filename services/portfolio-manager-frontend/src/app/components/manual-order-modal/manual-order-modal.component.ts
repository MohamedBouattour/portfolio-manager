import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-manual-order-modal',
  imports: [CommonModule, FormsModule],
  template: `
    @if (state.showOrderModal()) {
      <div class="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex justify-center items-center z-50 px-3" (click)="state.closeOrderModal()">
        <div class="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-md shadow-[0_20px_25px_-5px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden" (click)="$event.stopPropagation()">
          <div class="px-5 py-4 border-b border-slate-700/40 flex justify-between items-center">
            <h3 class="text-sm font-semibold text-amber-400">&#x26A1; Manual Order Execution</h3>
            <button class="bg-transparent border-none text-slate-400 text-2xl cursor-pointer leading-none hover:text-slate-100 transition-colors" (click)="state.closeOrderModal()">&times;</button>
          </div>

          <div class="p-5 space-y-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-[11px] font-semibold text-slate-400">Symbol</label>
              <input type="text" [value]="state.modalSymbol()" disabled class="form-input !bg-slate-700/50 !text-slate-400 !cursor-not-allowed" />
            </div>

            <div class="flex gap-4">
              <div class="flex-1 flex flex-col gap-1.5">
                <label class="text-[11px] font-semibold text-slate-400">Side (Action)</label>
                <select [ngModel]="state.modalSide()" (ngModelChange)="state.modalSide.set($event)" class="form-input">
                  <option value="Buy">BUY (Long)</option>
                  <option value="Sell">SELL (Short)</option>
                </select>
              </div>
              <div class="flex-1 flex flex-col gap-1.5">
                <label class="text-[11px] font-semibold text-slate-400">Leverage</label>
                <input type="number" [ngModel]="state.modalLeverage()" (ngModelChange)="state.modalLeverage.set(+$event)" class="form-input" min="1" max="100" />
              </div>
            </div>

            <div class="flex gap-4">
              <div class="flex-1 flex flex-col gap-1.5">
                <label class="text-[11px] font-semibold text-slate-400">Quantity (Size in Units)</label>
                <input type="number" [ngModel]="state.modalQty()" (ngModelChange)="state.modalQty.set(+$event)" class="form-input" min="0.001" step="0.01" />
              </div>
              <div class="flex-1 flex flex-col justify-end pb-2.5">
                <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                  <input type="checkbox" [ngModel]="state.modalReduceOnly()" (ngModelChange)="state.modalReduceOnly.set($event)" class="w-4 h-4 accent-amber-400 cursor-pointer" />
                  Reduce Only
                </label>
              </div>
            </div>

            <div class="bg-slate-800/40 border border-slate-600/30 rounded-xl p-3.5">
              <div class="text-[11px] font-bold uppercase text-slate-400 mb-2.5 tracking-wider">Order Cost Summary</div>
              <div class="grid grid-cols-3 gap-2.5">
                <div class="flex flex-col gap-1">
                  <span class="text-[11px] text-slate-400">Current Price</span>
                  <span class="text-sm font-semibold text-slate-100">\${{ state.modalAssetPrice().toFixed(2) }}</span>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-[11px] text-slate-400">Est. Order Value</span>
                  <span class="text-sm font-semibold text-slate-100">\${{ state.modalNotional().toFixed(2) }}</span>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-[11px] text-slate-400">Est. Margin Needed</span>
                  <span class="text-sm font-bold text-amber-400">\${{ state.modalMargin().toFixed(2) }}</span>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-[11px] font-semibold text-slate-400">Reason / Note</label>
              <input type="text" [ngModel]="state.modalReason()" (ngModelChange)="state.modalReason.set($event)" class="form-input" placeholder="e.g. Manual Override" />
            </div>
          </div>

          <div class="px-5 py-4 border-t border-slate-700/40 flex justify-end gap-3 bg-slate-900/40">
            <button (click)="state.closeOrderModal()" class="btn btn-secondary px-4 py-2">Cancel</button>
            <button (click)="state.executeModalOrder()" [disabled]="state.orderExecuting() || state.modalQty() <= 0" class="btn bg-gradient-to-r from-amber-400 to-amber-600 text-slate-900 font-bold border-none shadow-[0_4px_14px_rgba(251,191,36,0.4)] hover:from-amber-300 hover:to-amber-500 hover:-translate-y-0.5 transition-all disabled:from-slate-600 disabled:to-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none px-4 py-2 text-sm rounded-lg">
              @if (state.orderExecuting()) {
                <span class="spinner !w-4 !h-4 inline-block"></span> Executing...
              } @else {
                &#x1F680; Confirm &amp; Execute Market Order
              }
            </button>
          </div>

          @if (state.orderStatus(); as status) {
            <div
              class="px-5 py-2.5 text-center text-[11px] font-medium"
              [ngClass]="status === 'success' ? 'bg-emerald-500/15 text-emerald-400' : status.startsWith('error') ? 'bg-rose-500/15 text-rose-300' : ''"
            >
              {{ status === 'success' ? 'Order executed successfully!' : status }}
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
}
