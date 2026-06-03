import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-app-console',
  imports: [CommonModule],
  template: `
    <div class="card console-card">
      <div class="card-header">
        <div class="flex items-center gap-2.5">
          <span class="flex gap-1.5">
            <span class="w-3 h-3 rounded-full bg-rose-400"></span>
            <span class="w-3 h-3 rounded-full bg-amber-400"></span>
            <span class="w-3 h-3 rounded-full bg-emerald-400"></span>
          </span>
          <h3 class="text-sm font-semibold text-slate-100">&#x1F916; Bot Live Execution Log Console</h3>
        </div>
        @if (state.latestLogTimestamp() > 0) {
          <span class="text-[11px] font-mono bg-white/5 px-2 py-0.5 rounded text-slate-400">
            Last Run: {{ formatCandleDate(state.latestLogTimestamp() / 1000) }}
          </span>
        }
      </div>
      <div class="p-4 max-h-[350px] overflow-y-auto bg-slate-950/80">
        <pre class="m-0 whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-slate-200"><code>{{ state.latestLog() }}</code></pre>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppConsoleComponent {
  state = inject(StateService);

  formatCandleDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const yyyy = date.getFullYear();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const hh = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }
}
