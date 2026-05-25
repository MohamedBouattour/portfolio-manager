import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-header',
  template: `
    <header class="navbar">
      <div class="brand">
        <span class="logo">⚡</span>
        <h1>Bybit Stock Bot Sandbox</h1>
      </div>
      <div class="system-status">
        <span class="status-dot"></span>
        <span class="status-text">Backend: Connected</span>
      </div>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {}
