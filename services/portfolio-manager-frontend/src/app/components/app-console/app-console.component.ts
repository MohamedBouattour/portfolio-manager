import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from '../../core/services/state.service.js';

@Component({
  selector: 'app-app-console',
  imports: [CommonModule],
  template: `
    <div class="card console-card">
      <div class="card-header">
        <div class="header-left flex-row align-center gap-10">
          <span class="terminal-dots">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </span>
          <h3>🤖 Bot Live Execution Log Console</h3>
        </div>
        @if (state.latestLogTimestamp() > 0) {
          <span class="log-timestamp-badge">
            Last Run: {{ formatCandleDate(state.latestLogTimestamp() / 1000) }}
          </span>
        }
      </div>
      <div class="console-body">
        <pre class="console-output"><code>{{ state.latestLog() }}</code></pre>
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
