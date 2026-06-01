import { Component, OnInit, inject, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { StateService } from './core/services/state.service.js';
import { HeaderComponent } from './components/header/header.component.js';
import { MomentumTickerComponent } from './components/momentum-ticker/momentum-ticker.component.js';
import { StockCatalogComponent } from './components/stock-catalog/stock-catalog.component.js';
import { HistoricalChartComponent } from './components/historical-chart/historical-chart.component.js';
import { PositionsTableComponent } from './components/positions-table/positions-table.component.js';
import { UptrendScouterComponent } from './components/uptrend-scouter/uptrend-scouter.component.js';
import { SimulationSettingsComponent } from './components/simulation-settings/simulation-settings.component.js';
import { BotDecisionComponent } from './components/bot-decision/bot-decision.component.js';
import { AppConsoleComponent } from './components/app-console/app-console.component.js';
import { ManualOrderModalComponent } from './components/manual-order-modal/manual-order-modal.component.js';
import { PortfolioAllocationComponent } from './components/portfolio-allocation/portfolio-allocation.component.js';

@Component({
  selector: 'app-root',
  imports: [
    HeaderComponent,
    MomentumTickerComponent,
    StockCatalogComponent,
    HistoricalChartComponent,
    PositionsTableComponent,
    UptrendScouterComponent,
    SimulationSettingsComponent,
    BotDecisionComponent,
    AppConsoleComponent,
    ManualOrderModalComponent,
    PortfolioAllocationComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:keydown)': 'handleKeyDown($event)'
  }
})
export class AppComponent implements OnInit {
  state = inject(StateService);

  ngOnInit() {
    this.state.initialize();
  }

  handleKeyDown(event: KeyboardEvent) {
    const activeEl = document.activeElement;
    if (activeEl) {
      const tagName = activeEl.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        return;
      }
    }

    const data = this.state.klines();
    if (data.length === 0) return;

    const currentIdx = this.state.selectedIndex();
    if (currentIdx === null) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const nextIdx = Math.max(0, currentIdx - 1);
      this.state.selectedIndex.set(nextIdx);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      const nextIdx = Math.min(data.length - 1, currentIdx + 1);
      this.state.selectedIndex.set(nextIdx);
    }
  }
}
