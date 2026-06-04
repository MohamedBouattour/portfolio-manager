import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-header',
  template: `
    <header class="flex md:hidden justify-between items-center px-4 py-3 bg-[#141d24]/90 border-b border-slate-800/80 shadow-md">
      <div class="flex items-center gap-2">
        <span class="text-xl bg-gradient-to-br from-amber-400 to-amber-600 bg-clip-text text-transparent">&#x26A1;</span>
        <h1 class="text-sm font-extrabold text-white tracking-tight">Bybit Stock Bot Sandbox</h1>
      </div>
      <div class="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
        <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981] animate-pulse"></span>
        <span class="text-[10px] font-bold text-emerald-400">Connected</span>
      </div>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {}
