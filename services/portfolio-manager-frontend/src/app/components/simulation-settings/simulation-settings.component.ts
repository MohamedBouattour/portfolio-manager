import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-simulation-settings',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-[#141d24]/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full transition-all duration-300">
      @if (state.rightSidebarCollapsed()) {
        <!-- Collapsed Compact State -->
        <div class="flex flex-col items-center py-5 h-full justify-between bg-[#18232c]/50">
          <button 
            (click)="state.rightSidebarCollapsed.set(false)" 
            class="text-emerald-400 hover:text-white text-lg p-2 rounded-lg bg-[#0d131a] border border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors shadow-md"
            title="Expand Sidebar"
          >
            ⚙️
          </button>
          
          <div class="flex-1 flex items-center justify-center">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-widest font-sans whitespace-nowrap select-none" style="writing-mode: vertical-rl; transform: rotate(180deg);">
              Config &amp; Status
            </span>
          </div>

          <span class="relative flex h-2.5 w-2.5 mb-2 shrink-0">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        </div>
      } @else {
        <!-- Header -->
        <div class="px-5 py-4 border-b border-slate-800/60 flex justify-between items-center bg-[#18232c]/50">
          <h3 class="text-sm font-extrabold text-white tracking-wide">Configuration &amp; Status</h3>
          <button 
            (click)="state.rightSidebarCollapsed.set(true)" 
            class="text-slate-400 hover:text-white text-xs font-extrabold px-2 py-1 rounded bg-[#0d131a]/60 hover:bg-slate-800 border border-slate-800 cursor-pointer transition-colors"
            title="Collapse Sidebar"
          >
            Collapse ➔
          </button>
        </div>

        <div class="p-5 flex-1 space-y-6 overflow-y-auto custom-scrollbar">
          
          <!-- Section 1: Real-Time Bot Configuration -->
          <div class="space-y-4">
            <button 
              (click)="showBotConfig.set(!showBotConfig())"
              class="w-full flex justify-between items-center text-xs font-bold uppercase tracking-wider text-[#8696a0] border-b border-slate-800/60 pb-1.5 hover:text-white cursor-pointer transition-colors"
            >
              <span>Real-Time Bot Configuration</span>
              <span class="text-xs">{{ showBotConfig() ? '▲' : '▼' }}</span>
            </button>
            
            @if (showBotConfig()) {
              <div class="space-y-3 animate-fade-in">
                <!-- Strategy Selection -->
                <div class="flex justify-between items-center gap-3">
                  <label class="text-xs font-semibold text-slate-400">Strategy</label>
                  <select class="bg-[#0d131a] border border-slate-800 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-emerald-500 w-32 cursor-pointer">
                    <option value="momentum">Momentum</option>
                    <option value="macd">MACD Crossover</option>
                    <option value="rsi">RSI Scalper</option>
                  </select>
                </div>

                <!-- Leverage Selection -->
                <div class="flex justify-between items-center gap-3">
                  <label class="text-xs font-semibold text-slate-400">Leverage</label>
                  <select 
                    [ngModel]="state.botLeverage()" 
                    (ngModelChange)="state.botLeverage.set(+$event)"
                    class="bg-[#0d131a] border border-slate-800 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-emerald-500 w-32 cursor-pointer"
                  >
                    <option value="1">1x</option>
                    <option value="3">3x</option>
                    <option value="5">5x</option>
                    <option value="6">6x</option>
                    <option value="10">10x</option>
                    <option value="20">20x</option>
                    <option value="50">50x</option>
                  </select>
                </div>

                <!-- Bot Oversight -->
                <div class="flex justify-between items-center gap-3">
                  <label class="text-xs font-semibold text-slate-400">Bot Oversight</label>
                  <select class="bg-[#0d131a] border border-slate-800 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-emerald-500 w-32 cursor-pointer">
                    <option value="none">None</option>
                    <option value="guard">Manual Guard</option>
                  </select>
                </div>

                <!-- Bot Live Toggle -->
                <div class="flex justify-between items-center gap-3 pt-1">
                  <label class="text-xs font-bold text-slate-300">Bot Live / Active</label>
                  <button 
                    (click)="toggleBotLive()"
                    [ngClass]="!state.manualMode() ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-800 border-slate-700'"
                    class="w-12 h-6 rounded-full border p-0.5 transition-all duration-300 relative focus:outline-none cursor-pointer"
                  >
                    <span 
                      [ngClass]="!state.manualMode() ? 'translate-x-6 bg-slate-950' : 'translate-x-0 bg-slate-400'"
                      class="block w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-300"
                    ></span>
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Section 2: Risk Parameters -->
          <div class="space-y-4">
            <button 
              (click)="showRiskParams.set(!showRiskParams())"
              class="w-full flex justify-between items-center text-xs font-bold uppercase tracking-wider text-[#8696a0] border-b border-slate-800/60 pb-1.5 hover:text-white cursor-pointer transition-colors"
            >
              <span>Risk Parameters</span>
              <span class="text-xs">{{ showRiskParams() ? '▲' : '▼' }}</span>
            </button>

            @if (showRiskParams()) {
              <div class="grid grid-cols-2 gap-3.5 animate-fade-in">
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-bold text-slate-350 uppercase tracking-wide">Stop Loss</label>
                  <div class="relative flex items-center bg-[#0d131a] border border-slate-800 rounded-lg overflow-hidden">
                    <input 
                      type="number" 
                      [ngModel]="state.rebuyThresholdPct()" 
                      (ngModelChange)="state.rebuyThresholdPct.set(+$event)"
                      class="w-full bg-transparent px-3 py-2 text-xs font-bold text-slate-100 outline-none tabular-nums"
                      min="1"
                    />
                    <span class="absolute right-3 text-slate-400 text-xs font-bold font-mono">%</span>
                  </div>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-bold text-slate-350 uppercase tracking-wide">Take Profit</label>
                  <div class="relative flex items-center bg-[#0d131a] border border-slate-800 rounded-lg overflow-hidden">
                    <input 
                      type="number" 
                      [ngModel]="state.profitThresholdPct()" 
                      (ngModelChange)="state.profitThresholdPct.set(+$event)"
                      class="w-full bg-transparent px-3 py-2 text-xs font-bold text-slate-100 outline-none tabular-nums"
                      min="1"
                    />
                    <span class="absolute right-3 text-slate-400 text-xs font-bold font-mono">%</span>
                  </div>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-bold text-slate-350 uppercase tracking-wide">Stop Breakeven</label>
                  <div class="relative flex items-center bg-[#0d131a] border border-slate-800 rounded-lg overflow-hidden">
                    <input 
                      type="number" 
                      [ngModel]="state.reducePct()" 
                      (ngModelChange)="state.reducePct.set(+$event)"
                      class="w-full bg-transparent px-3 py-2 text-xs font-bold text-slate-100 outline-none tabular-nums"
                      min="1"
                    />
                    <span class="absolute right-3 text-slate-400 text-xs font-bold font-mono">%</span>
                  </div>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-bold text-slate-350 uppercase tracking-wide">Take Breakeven</label>
                  <div class="relative flex items-center bg-[#0d131a] border border-slate-800 rounded-lg overflow-hidden">
                    <input 
                      type="number" 
                      [ngModel]="state.rebuyQtyPct()" 
                      (ngModelChange)="state.rebuyQtyPct.set(+$event)"
                      class="w-full bg-transparent px-3 py-2 text-xs font-bold text-slate-100 outline-none tabular-nums"
                      min="1"
                    />
                    <span class="absolute right-3 text-slate-400 text-xs font-bold font-mono">%</span>
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- Section 3: Collapsible Simulation and Wallet Config -->
          <div class="space-y-3">
            <button 
              (click)="showSimConfig.set(!showSimConfig())"
              class="w-full flex justify-between items-center text-xs font-bold uppercase tracking-wider text-[#8696a0] hover:text-white cursor-pointer bg-[#0d131a]/60 p-2.5 rounded-lg border border-slate-800/80 transition-all"
            >
              <span>Simulated Position &amp; Wallet settings</span>
              <span class="text-xs">{{ showSimConfig() ? '▲' : '▼' }}</span>
            </button>

            @if (showSimConfig()) {
              <div class="space-y-4 bg-slate-950/40 p-3 rounded-xl border border-slate-900/80 animate-fade-in">
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">Initial Balance ($)</label>
                    <input type="number" [ngModel]="state.botBalance()" (ngModelChange)="state.botBalance.set(+$event)" class="bg-[#0d131a] border border-slate-850 px-2.5 py-1.5 rounded-md text-xs text-white" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">Max Alloc (% Bal)</label>
                    <input type="number" [ngModel]="state.maxAllocPct()" (ngModelChange)="state.maxAllocPct.set(+$event)" class="bg-[#0d131a] border border-slate-850 px-2.5 py-1.5 rounded-md text-xs text-white" />
                  </div>
                </div>

                <div class="border-t border-slate-850 pt-3 space-y-3">
                  <div class="text-xs font-extrabold uppercase tracking-wider text-slate-300">Position Simulation</div>
                  
                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-semibold text-slate-400">Side</label>
                    <select [ngModel]="state.simSide()" (ngModelChange)="state.simSide.set($event)" class="bg-[#0d131a] border border-slate-850 px-2.5 py-1.5 rounded-md text-xs text-white cursor-pointer w-full">
                      <option value="None">None (No Position)</option>
                      <option value="Buy">Long (Buy)</option>
                      <option value="Sell">Short (Sell)</option>
                    </select>
                  </div>

                  @if (state.simSide() !== 'None') {
                    <div class="grid grid-cols-2 gap-3">
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-semibold text-slate-400">Size (Units)</label>
                        <input type="number" [ngModel]="state.simSize()" (ngModelChange)="state.simSize.set(+$event)" class="bg-[#0d131a] border border-slate-850 px-2.5 py-1.5 rounded-md text-xs text-white" step="0.1" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-semibold text-slate-400">Avg Entry ($)</label>
                        <input type="number" [ngModel]="state.simAvgPrice()" (ngModelChange)="state.simAvgPrice.set(+$event)" class="bg-[#0d131a] border border-slate-850 px-2.5 py-1.5 rounded-md text-xs text-white" step="1" />
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Status Box -->
          <div class="pt-4 border-t border-slate-800/60">
            <div class="flex items-center justify-between bg-emerald-500/10 px-4 py-3 rounded-xl border border-emerald-500/25">
              <div class="flex items-center gap-2">
                <!-- Pulsing green dot indicator inside green outline -->
                <span class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span class="text-xs font-extrabold text-emerald-400">Backend System</span>
              </div>
              <span class="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/10">
                Connected
              </span>
            </div>
          </div>

        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimulationSettingsComponent {
  state = inject(StateService);
  showBotConfig = signal(true);
  showRiskParams = signal(true);
  showSimConfig = signal(false);

  toggleBotLive() {
    // manualMode=false means bot is live/auto, manualMode=true means bot has run guard/manual
    const currentlyLive = !this.state.manualMode();
    this.state.manualMode.set(currentlyLive);
  }
}
