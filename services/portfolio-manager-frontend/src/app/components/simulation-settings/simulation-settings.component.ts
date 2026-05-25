import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-simulation-settings',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card config-card">
      <div class="card-header">
        <h3>Simulated Position & Config</h3>
      </div>
      
      <div class="config-form">
        <div class="form-section-title">Position State</div>
        <div class="form-row flex-row">
          <div class="form-group flex-1">
            <label>Side</label>
            <select [ngModel]="state.simSide()" (ngModelChange)="state.simSide.set($event)" class="form-input">
              <option value="None">None (No Position)</option>
              <option value="Buy">Long (Buy)</option>
              <option value="Sell">Short (Sell)</option>
            </select>
          </div>
          
          @if (state.simSide() !== 'None') {
            <div class="form-group flex-1">
              <label>Size (Units)</label>
              <input 
                type="number" 
                [ngModel]="state.simSize()" 
                (ngModelChange)="state.simSize.set(+$event)" 
                class="form-input" 
                min="0.001" 
                step="0.1"
              />
            </div>
            <div class="form-group flex-1">
              <label>Entry Price ($)</label>
              <input 
                type="number" 
                [ngModel]="state.simAvgPrice()" 
                (ngModelChange)="state.simAvgPrice.set(+$event)" 
                class="form-input" 
                min="0.01" 
                step="1"
              />
            </div>
          }
        </div>

        <div class="form-section-title">Bot Variables & Risk</div>
        <div class="form-row grid-2">
          <div class="form-group">
            <label>Leverage</label>
            <input 
              type="number" 
              [ngModel]="state.botLeverage()" 
              (ngModelChange)="state.botLeverage.set(+$event)" 
              class="form-input" 
              min="1" 
              max="100"
            />
          </div>
          <div class="form-group">
            <label>Balance ($)</label>
            <input 
              type="number" 
              [ngModel]="state.botBalance()" 
              (ngModelChange)="state.botBalance.set(+$event)" 
              class="form-input" 
              min="1"
            />
          </div>
          <div class="form-group">
            <label>Take Profit (TP %)</label>
            <input 
              type="number" 
              [ngModel]="state.profitThresholdPct()" 
              (ngModelChange)="state.profitThresholdPct.set(+$event)" 
              class="form-input" 
              min="1"
            />
          </div>
          <div class="form-group">
            <label>DCA Rebuy (DCA %)</label>
            <input 
              type="number" 
              [ngModel]="state.rebuyThresholdPct()" 
              (ngModelChange)="state.rebuyThresholdPct.set(+$event)" 
              class="form-input" 
              min="1"
            />
          </div>
          <div class="form-group">
            <label>Reduce Size (Reduce %)</label>
            <input 
              type="number" 
              [ngModel]="state.reducePct()" 
              (ngModelChange)="state.reducePct.set(+$event)" 
              class="form-input" 
              min="1" 
              max="100"
            />
          </div>
          <div class="form-group">
            <label>Rebuy Size (Rebuy %)</label>
            <input 
              type="number" 
              [ngModel]="state.rebuyQtyPct()" 
              (ngModelChange)="state.rebuyQtyPct.set(+$event)" 
              class="form-input" 
              min="1" 
              max="100"
            />
          </div>
          <div class="form-group">
            <label>Max Alloc (% Balance)</label>
            <input 
              type="number" 
              [ngModel]="state.maxAllocPct()" 
              (ngModelChange)="state.maxAllocPct.set(+$event)" 
              class="form-input" 
              min="1" 
              max="100"
            />
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
