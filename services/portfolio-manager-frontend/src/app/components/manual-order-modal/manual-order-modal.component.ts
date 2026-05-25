import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-manual-order-modal',
  imports: [CommonModule, FormsModule],
  template: `
    @if (state.showOrderModal()) {
      <div class="modal-backdrop" (click)="state.closeOrderModal()">
        <div class="modal-container" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>⚡ Manual Order Execution</h3>
            <button class="modal-close-btn" (click)="state.closeOrderModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Symbol</label>
              <input type="text" [value]="state.modalSymbol()" disabled class="form-input disabled-input" />
            </div>
            <div class="form-row flex-row gap-15">
              <div class="form-group flex-1">
                <label>Side (Action)</label>
                <select [ngModel]="state.modalSide()" (ngModelChange)="state.modalSide.set($event)" class="form-input">
                  <option value="Buy">BUY (Long)</option>
                  <option value="Sell">SELL (Short)</option>
                </select>
              </div>
              <div class="form-group flex-1">
                <label>Leverage</label>
                <input 
                  type="number" 
                  [ngModel]="state.modalLeverage()" 
                  (ngModelChange)="state.modalLeverage.set(+$event)" 
                  class="form-input" 
                  min="1" 
                  max="100"
                />
              </div>
            </div>
            <div class="form-row flex-row gap-15">
              <div class="form-group flex-1">
                <label>Quantity (Size in Units)</label>
                <input 
                  type="number" 
                  [ngModel]="state.modalQty()" 
                  (ngModelChange)="state.modalQty.set(+$event)" 
                  class="form-input" 
                  min="0.001" 
                  step="0.01"
                />
              </div>
              <div class="form-group flex-1 flex-align-end pd-bottom-10">
                <label class="checkbox-label">
                  <input 
                    type="checkbox" 
                    [ngModel]="state.modalReduceOnly()" 
                    (ngModelChange)="state.modalReduceOnly.set($event)" 
                    class="checkbox-input"
                  />
                  Reduce Only
                </label>
              </div>
            </div>
            <div class="order-summary-box">
              <div class="summary-title">Order Cost Summary</div>
              <div class="summary-grid">
                <div class="summary-item">
                  <span class="lbl">Current Price</span>
                  <span class="val">\${{ state.modalAssetPrice().toFixed(2) }}</span>
                </div>
                <div class="summary-item">
                  <span class="lbl">Est. Order Value</span>
                  <span class="val">\${{ state.modalNotional().toFixed(2) }}</span>
                </div>
                <div class="summary-item">
                  <span class="lbl">Est. Margin Needed</span>
                  <span class="val highlight">\${{ state.modalMargin().toFixed(2) }}</span>
                </div>
              </div>
            </div>
            <div class="form-group pt-10">
              <label>Reason / Note</label>
              <input 
                type="text" 
                [ngModel]="state.modalReason()" 
                (ngModelChange)="state.modalReason.set($event)" 
                class="form-input" 
                placeholder="e.g. Manual Override" 
              />
            </div>
          </div>
          <div class="modal-footer">
            <button (click)="state.closeOrderModal()" class="btn btn-secondary">Cancel</button>
            <button 
              (click)="state.executeModalOrder()" 
              [disabled]="state.orderExecuting() || state.modalQty() <= 0" 
              class="btn btn-primary btn-modal-confirm"
            >
              @if (state.orderExecuting()) {
                <span class="spinner inline-spinner"></span> Executing...
              } @else {
                🚀 Confirm & Execute Market Order
              }
            </button>
          </div>
          @if (state.orderStatus()) {
            <div 
              class="modal-status-alert" 
              [class.success]="state.orderStatus() === 'success'" 
              [class.error]="state.orderStatus()?.startsWith('error')"
            >
              {{ state.orderStatus() === 'success' ? 'Order executed successfully!' : state.orderStatus() }}
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
