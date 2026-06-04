import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-app-console',
  imports: [CommonModule],
  template: `
    <div class="bg-[#141d24]/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      <!-- Terminal Bar Header -->
      <div class="px-5 py-3.5 border-b border-slate-800/60 flex justify-between items-center bg-[#18232c]/50">
        <div class="flex items-center gap-2.5">
          <!-- macOS terminal style buttons -->
          <div class="flex gap-1.5 shrink-0">
            <span class="w-2.5 h-2.5 rounded-full bg-[#f43f5e] opacity-80"></span>
            <span class="w-2.5 h-2.5 rounded-full bg-[#fbbf24] opacity-80"></span>
            <span class="w-2.5 h-2.5 rounded-full bg-[#10b981] opacity-80"></span>
          </div>
          <h3 class="text-xs font-bold text-slate-300 tracking-wide font-sans ml-1">🤖 Bot Live Execution Log Console</h3>
        </div>
        
        @if (state.latestLogTimestamp() > 0) {
          <span class="text-xs font-mono bg-white/5 border border-white/5 px-2.5 py-0.5 rounded-md text-slate-400">
            Last Executed: {{ formatCandleDate(state.latestLogTimestamp() / 1000) }}
          </span>
        }
      </div>

      <!-- Log Pre code output -->
      <div class="p-4 max-h-[300px] overflow-y-auto bg-[#0a0e14]/90 custom-scrollbar border-t border-slate-900">
        <pre class="m-0 whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-slate-300"><code>{{ state.latestLog() }}</code></pre>
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
