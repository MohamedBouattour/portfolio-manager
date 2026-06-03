import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-simulation-settings',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card config-card flex flex-col">
      <div class="card-header">
        <h3 class="text-sm font-semibold text-slate-100">Simulated Position &amp; Config</h3>
      </div>

      <div class="p-5 space-y-4">
        <div class="text-[11px] font-bold uppercase tracking-wider text-blue-400 border-l-2 border-blue-500 pl-2">Position State</div>
        <div class="flex flex-col sm:flex-row gap-3">
          <div class="flex flex-col gap-1.5 flex-1">
            <label class="text-[11px] font-semibold text-slate-400">Side</label>
            <select [ngModel]="state.simSide()" (ngModelChange)="state.simSide.set($event)" class="form-input">
              <option value="None">None (No Position)</option>
              <option value="Buy">Long (Buy)</option>
              <option value="Sell">Short (Sell)</option>
            </select>
          </div>

          @if (state.simSide() !== 'None') {
            <div class="flex flex-col gap-1.5 flex-1">
              <label class="text-[11px] font-semibold text-slate-400">Size (Units)</label>
              <input type="number" [ngModel]="state.simSize()" (ngModelChange)="state.simSize.set(+$event)" class="form-input" min="0.001" step="0.1" />
            </div>
            <div class="flex flex-col gap-1.5 flex-1">
              <label class="text-[11px] font-semibold text-slate-400">Entry Price ($)</label>
              <input type="number" [ngModel]="state.simAvgPrice()" (ngModelChange)="state.simAvgPrice.set(+$event)" class="form-input" min="0.01" step="1" />
            </div>
          }
        </div>

        <div class="text-[11px] font-bold uppercase tracking-wider text-blue-400 border-l-2 border-blue-500 pl-2">Bot Variables &amp; Risk</div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-semibold text-slate-400">Leverage</label>
            <input type="number" [ngModel]="state.botLeverage()" (ngModelChange)="state.botLeverage.set(+$event)" class="form-input" min="1" max="100" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-semibold text-slate-400">Balance ($)</label>
            <input type="number" [ngModel]="state.botBalance()" (ngModelChange)="state.botBalance.set(+$event)" class="form-input" min="1" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-semibold text-slate-400">Take Profit (TP %)</label>
            <input type="number" [ngModel]="state.profitThresholdPct()" (ngModelChange)="state.profitThresholdPct.set(+$event)" class="form-input" min="1" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-semibold text-slate-400">DCA Rebuy (DCA %)</label>
            <input type="number" [ngModel]="state.rebuyThresholdPct()" (ngModelChange)="state.rebuyThresholdPct.set(+$event)" class="form-input" min="1" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-semibold text-slate-400">Reduce Size (Reduce %)</label>
            <input type="number" [ngModel]="state.reducePct()" (ngModelChange)="state.reducePct.set(+$event)" class="form-input" min="1" max="100" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-semibold text-slate-400">Rebuy Size (Rebuy %)</label>
            <input type="number" [ngModel]="state.rebuyQtyPct()" (ngModelChange)="state.rebuyQtyPct.set(+$event)" class="form-input" min="1" max="100" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-semibold text-slate-400">Max Alloc (% Balance)</label>
            <input type="number" [ngModel]="state.maxAllocPct()" (ngModelChange)="state.maxAllocPct.set(+$event)" class="form-input" min="1" max="100" />
          </div>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimulationSettingsComponent {
  state = inject(StateService);
}
