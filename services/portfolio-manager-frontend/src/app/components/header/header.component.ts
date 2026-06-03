import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-header',
  template: `
    <header class="flex justify-between items-center px-4 sm:px-6 lg:px-8 py-4 border-b border-slate-700/40 max-w-7xl mx-auto">
      <div class="flex items-center gap-3">
        <span class="text-2xl bg-gradient-to-br from-amber-400 to-amber-600 bg-clip-text text-transparent">&#x26A1;</span>
        <h1 class="text-lg sm:text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent tracking-tight">Bybit Stock Bot Sandbox</h1>
      </div>
      <div class="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
        <span class="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></span>
        <span class="text-xs font-semibold text-emerald-400">Backend: Connected</span>
      </div>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {}
