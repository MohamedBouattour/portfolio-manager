import { Component, inject, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';
import { OperationRecord } from '../../types.js';

@Component({
  selector: 'app-operations-history',
  imports: [CommonModule],
  template: `
    <div class="bg-[#141d24]/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      <!-- Card Header -->
      <div class="px-5 py-4 border-b border-slate-800/60 flex flex-wrap justify-between items-center gap-3 bg-[#18232c]/50">
        <div class="flex items-center gap-2.5">
          <h3 class="text-sm font-extrabold text-white tracking-wide">📋 Operations History</h3>
          <span class="text-xs font-bold text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-full border border-slate-800">
            {{ filteredOps().length }} operation{{ filteredOps().length !== 1 ? 's' : '' }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <!-- Action filter pills -->
          <div class="flex gap-1">
            @for (filter of actionFilters; track filter.value) {
              <button
                (click)="toggleFilter(filter.value)"
                [ngClass]="activeFilter() === filter.value
                  ? filter.activeClass
                  : 'bg-slate-900/50 text-slate-500 border-slate-800/60'"
                class="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg border cursor-pointer transition-all tracking-wider"
              >
                {{ filter.label }}
              </button>
            }
          </div>
          <button
            (click)="state.fetchOperations()"
            class="px-3 py-1.5 bg-[#0f161c] hover:bg-slate-800 text-[#8696a0] hover:text-white border border-slate-800 text-xs font-bold rounded-lg cursor-pointer transition-all"
          >
            🔄
          </button>
        </div>
      </div>

      <div class="p-5 bg-[#0d131a]/40">
        @if (filteredOps().length > 0) {
          <div class="overflow-x-auto border border-slate-850 rounded-xl bg-[#0f161c]/20">
            <table class="w-full border-collapse text-left text-xs font-sans">
              <thead>
                <tr class="bg-[#0f161c]/70 border-b border-slate-850 text-slate-300 font-bold">
                  <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Time</th>
                  <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Asset</th>
                  <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Action</th>
                  <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Side</th>
                  <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Qty</th>
                  <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Price</th>
                  <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Avg Before → After</th>
                  <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">ROI Before</th>
                  <th class="p-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Source</th>
                </tr>
              </thead>
              <tbody>
                @for (op of filteredOps(); track op.id) {
                  <tr
                    (click)="state.selectAsset(op.symbol)"
                    class="cursor-pointer transition-colors border-b border-slate-850/60 hover:bg-slate-800/10"
                    [ngClass]="getRowHighlight(op)"
                  >
                    <!-- Time -->
                    <td class="p-3 whitespace-nowrap">
                      <div class="flex flex-col">
                        <span class="text-slate-200 font-bold text-xs">{{ getRelativeTime(op.createdAt) }}</span>
                        <span class="text-[10px] text-slate-500 font-mono mt-0.5">{{ formatDate(op.createdAt) }}</span>
                      </div>
                    </td>

                    <!-- Asset -->
                    <td class="p-3 whitespace-nowrap">
                      <span class="font-extrabold text-white text-xs">{{ op.symbol }}</span>
                    </td>

                    <!-- Action Badge -->
                    <td class="p-3 whitespace-nowrap">
                      <span
                        [ngClass]="getActionBadgeClass(op.action)"
                        class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border tracking-wider"
                      >
                        {{ getActionIcon(op.action) }} {{ op.action.replace('_', ' ') }}
                      </span>
                    </td>

                    <!-- Side -->
                    <td class="p-3 whitespace-nowrap">
                      <span
                        [ngClass]="op.side === 'Buy' ? 'text-emerald-400' : 'text-rose-400'"
                        class="font-extrabold text-xs"
                      >
                        {{ op.side }}
                      </span>
                    </td>

                    <!-- Qty -->
                    <td class="p-3 whitespace-nowrap">
                      <span class="font-bold text-slate-200 font-mono text-xs tabular-nums">
                        {{ op.qty > 0 ? op.qty.toFixed(4) : '—' }}
                      </span>
                    </td>

                    <!-- Price -->
                    <td class="p-3 whitespace-nowrap">
                      <span class="font-bold text-slate-200 font-mono text-xs tabular-nums">
                        {{ op.price > 0 ? '$' + op.price.toFixed(2) : '—' }}
                      </span>
                    </td>

                    <!-- Avg Before → After -->
                    <td class="p-3 whitespace-nowrap">
                      @if (op.avgPriceBefore && op.avgPriceAfter) {
                        <div class="flex items-center gap-1 font-mono text-xs tabular-nums">
                          <span class="text-slate-400">\${{ op.avgPriceBefore.toFixed(2) }}</span>
                          <span class="text-sky-400 font-bold">&#x2192;</span>
                          <span class="text-white font-bold">\${{ op.avgPriceAfter.toFixed(2) }}</span>
                        </div>
                      } @else if (op.avgPriceBefore) {
                        <span class="text-slate-400 font-mono text-xs">\${{ op.avgPriceBefore.toFixed(2) }}</span>
                      } @else {
                        <span class="text-slate-600 text-xs">—</span>
                      }
                    </td>

                    <!-- ROI Before -->
                    <td class="p-3 whitespace-nowrap">
                      @if (op.pnlPctBefore !== undefined && op.pnlPctBefore !== null) {
                        <span
                          [ngClass]="op.pnlPctBefore >= 0 ? 'text-emerald-400' : 'text-rose-400'"
                          class="font-bold font-mono text-xs tabular-nums"
                        >
                          {{ op.pnlPctBefore >= 0 ? '+' : '' }}{{ op.pnlPctBefore.toFixed(2) }}%
                        </span>
                      } @else {
                        <span class="text-slate-600 text-xs">—</span>
                      }
                    </td>

                    <!-- Source -->
                    <td class="p-3 whitespace-nowrap">
                      <span
                        [ngClass]="getSourceBadgeClass(op.source)"
                        class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border tracking-wider"
                      >
                        {{ op.source }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="flex flex-col items-center gap-3 py-14 bg-[#0f161c]/10 rounded-xl border border-slate-850">
            <span class="text-3xl text-slate-600">📋</span>
            <p class="text-xs text-slate-400 font-bold">No operations recorded yet. Operations will appear here as the bot executes trades.</p>
          </div>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperationsHistoryComponent {
  state = inject(StateService);

  activeFilter = signal<string>('ALL');

  actionFilters = [
    { value: 'ALL', label: 'All', activeClass: 'bg-slate-700/50 text-white border-slate-600' },
    { value: 'ENTRY', label: 'Entry', activeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    { value: 'DCA_REBUY', label: 'DCA', activeClass: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
    { value: 'TAKE_PROFIT', label: 'TP', activeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    { value: 'MANUAL', label: 'Manual', activeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    { value: 'CLOSE', label: 'Close', activeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  ];

  filteredOps = computed(() => {
    const ops = this.state.operations();
    const filter = this.activeFilter();
    if (filter === 'ALL') return ops;
    return ops.filter(op => op.action === filter);
  });

  toggleFilter(value: string) {
    this.activeFilter.set(this.activeFilter() === value ? 'ALL' : value);
  }

  getRelativeTime(dateStr?: string): string {
    if (!dateStr) return '—';
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return `${Math.floor(diffDay / 7)}w ago`;
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      hour12: false,
    });
  }

  getActionBadgeClass(action: string): string {
    switch (action) {
      case 'ENTRY': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'DCA_REBUY': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'TAKE_PROFIT': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'MANUAL': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'CLOSE': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  }

  getActionIcon(action: string): string {
    switch (action) {
      case 'ENTRY': return '🚀';
      case 'DCA_REBUY': return '🔵';
      case 'TAKE_PROFIT': return '🟢';
      case 'MANUAL': return '🟡';
      case 'CLOSE': return '🔴';
      default: return '⚪';
    }
  }

  getSourceBadgeClass(source: string): string {
    switch (source) {
      case 'bot': return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
      case 'manual': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'cron': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  }

  getRowHighlight(op: OperationRecord): string {
    switch (op.action) {
      case 'TAKE_PROFIT': return 'bg-emerald-500/[0.03]';
      case 'DCA_REBUY': return 'bg-cyan-500/[0.03]';
      case 'ENTRY': return 'bg-blue-500/[0.03]';
      case 'CLOSE': return 'bg-rose-500/[0.03]';
      default: return '';
    }
  }
}
