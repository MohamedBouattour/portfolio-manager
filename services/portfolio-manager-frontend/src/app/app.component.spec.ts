import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component.js';
import { StateService } from './core/services/state.service.js';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpTestingController } from '@angular/common/http/testing';

describe('AppComponent and StateService', () => {
  let component: AppComponent;
  let stateService: StateService;
  let httpMock: HttpTestingController;

  function flushInitCalls() {
    httpMock.match('http://localhost:3000/api/config').forEach(r => r.flush({ timeframe: 'D', manualMode: false }));
    httpMock.match('http://localhost:3000/api/stocks').forEach(r => r.flush([]));
    httpMock.match('http://localhost:3000/api/momentum').forEach(r => r.flush([]));
    httpMock.match('http://localhost:3000/api/scouting-status').forEach(r => r.flush([]));
    httpMock.match('http://localhost:3000/api/logs/latest').forEach(r => r.flush({ timestamp: 0, content: '' }));
    httpMock.match('http://localhost:3000/api/positions').forEach(r => r.flush([]));
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    stateService = TestBed.inject(StateService);
    (stateService as any).apiBase = 'http://localhost:3000/api';
    httpMock = TestBed.inject(HttpTestingController);
    
    // Trigger OnInit which calls state.initialize()
    fixture.detectChanges();
    flushInitCalls();
  });

  afterEach(() => {
    httpMock.match(r => true).forEach(r => r.flush({}));
    httpMock.verify();
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  describe('StateService', () => {
    it('should have default signal values', () => {
      expect(stateService.assets()).toEqual([]);
      expect(stateService.searchQuery()).toBe('');
      expect(stateService.selectedAsset()).toBeNull();
      expect(stateService.klines()).toEqual([]);
      expect(stateService.selectedIndex()).toBeNull();
      expect(stateService.evaluationResult()).toBeNull();
      expect(stateService.isLoading()).toBe(false);
      expect(stateService.isEvaluating()).toBe(false);
      expect(stateService.error()).toBeNull();
    });

    it('should compute filteredAssets', () => {
      stateService.assets.set(['AAPLUSDT', 'TSLAUSDT', 'NVDAUSDT']);
      expect(stateService.filteredAssets().length).toBe(3);
      stateService.searchQuery.set('aapl');
      expect(stateService.filteredAssets()).toEqual(['AAPLUSDT']);
    });

    it('should return all assets when searchQuery empty', () => {
      stateService.assets.set(['AAPLUSDT', 'TSLAUSDT']);
      expect(stateService.filteredAssets().length).toBe(2);
    });

    it('should compute hasScoutingSignal', () => {
      stateService.scoutingResults.set([{ symbol: 'AAPLUSDT', shouldEnter: true }]);
      expect(stateService.hasScoutingSignal('AAPLUSDT')).toBe(true);
      expect(stateService.hasScoutingSignal('TSLAUSDT')).toBe(false);
    });

    it('should getUptrendAssets', () => {
      stateService.scoutingResults.set([
        { symbol: 'AAPLUSDT', shouldEnter: true },
        { symbol: 'TSLAUSDT', shouldEnter: false },
      ]);
      expect(stateService.getUptrendAssets().length).toBe(1);
    });

    it('should compute selectedAssetScouting', () => {
      stateService.selectedAsset.set('AAPLUSDT');
      stateService.scoutingResults.set([{ symbol: 'AAPLUSDT', price: 150 }]);
      expect(stateService.selectedAssetScouting()?.symbol).toBe('AAPLUSDT');
    });

    it('getLogoColor should return HSL string', () => {
      expect(stateService.getLogoColor('AAPLUSDT')).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
    });

    it('getLogoColor should be consistent', () => {
      expect(stateService.getLogoColor('AAPLUSDT')).toBe(stateService.getLogoColor('AAPLUSDT'));
    });

    it('getLogoColor should differ for different symbols', () => {
      expect(stateService.getLogoColor('A')).not.toBe(stateService.getLogoColor('B'));
    });

    it('onLogoError should add to set', () => {
      stateService.onLogoError('AAPL');
      expect(stateService.logoErrors().has('AAPL')).toBe(true);
    });

    it('fetchConfig should fetch and update config', () => {
      stateService.fetchConfig();
      const req = httpMock.expectOne('http://localhost:3000/api/config');
      req.flush({ timeframe: '240', manualMode: true });
      expect(stateService.timeframe()).toBe('4h');
      expect(stateService.manualMode()).toBe(true);
    });

    it('fetchOpenPositions should fetch and update positions', () => {
      stateService.fetchOpenPositions();
      const req = httpMock.expectOne('http://localhost:3000/api/positions');
      req.flush([{ symbol: 'BTCUSDT' }]);
      expect(stateService.openPositions().length).toBe(1);
    });

    it('fetchMomentum should fetch and update momentum', () => {
      stateService.fetchMomentum();
      const req = httpMock.expectOne('http://localhost:3000/api/momentum');
      req.flush([{ symbol: 'AAPL', price: 150, changePct: 5 }]);
      expect(stateService.momentumStocks().length).toBe(1);
    });

    it('fetchScoutingStatus should fetch and update', () => {
      stateService.fetchScoutingStatus();
      httpMock.expectOne('http://localhost:3000/api/scouting-status').flush([{ symbol: 'A' }]);
      expect(stateService.scoutingResults().length).toBe(1);
    });

    it('fetchLatestLog should fetch and update log', () => {
      stateService.fetchLatestLog();
      httpMock.expectOne('http://localhost:3000/api/logs/latest').flush({ timestamp: 1, content: 'log' });
      expect(stateService.latestLog()).toBe('log');
    });

    it('getLogoUrl should return path', () => {
      expect(stateService.getLogoUrl('AAPL')).toBe('logos/AAPL.png');
    });

    it('should have default sim values', () => {
      expect(stateService.botBalance()).toBe(689);
      expect(stateService.botLeverage()).toBe(3);
      expect(stateService.rebuyQtyPct()).toBe(15);
      expect(stateService.maxAllocPct()).toBe(20);
    });

    describe('getPositionDecision', () => {
      const basePos = {
        symbol: 'AAPLUSDT', side: 'Buy' as const, size: 10,
        avgPrice: 100, markPrice: 100, unrealisedPnl: 0,
        positionValue: 1000, leverage: 3,
      };

      it('should return HOLD when PnL within thresholds', () => {
        const pos = { ...basePos, markPrice: 103, unrealisedPnl: 30 };
        const d = stateService.getPositionDecision(pos);
        expect(d.action).toBe('HOLD');
        expect(d.qty).toBe(0);
      });

      it('should return REDUCE when PnL >= profitThresholdPct', () => {
        const pos = { ...basePos, markPrice: 106, unrealisedPnl: 60 };
        const d = stateService.getPositionDecision(pos);
        expect(d.action).toBe('REDUCE');
        expect(d.qty).toBe(1.5);
      });

      it('should return HOLD (loop prevention) when lastExecutionPrice exists and markPrice has not risen enough for TP', () => {
        const pos = {
          ...basePos, markPrice: 106, unrealisedPnl: 60,
          lastExecutionPrice: 105, lastExecutionSide: 'Sell' as const,
        };
        const d = stateService.getPositionDecision(pos);
        expect(d.action).toBe('HOLD');
        expect(d.qty).toBe(0);
      });

      it('should return REDUCE when lastExecutionPrice exists and markPrice has risen enough for TP', () => {
        const pos = {
          ...basePos, markPrice: 111, unrealisedPnl: 100,
          lastExecutionPrice: 105, lastExecutionSide: 'Sell' as const,
        };
        const d = stateService.getPositionDecision(pos);
        expect(d.action).toBe('REDUCE');
        expect(d.qty).toBe(1.5);
      });

      it('should return DCA_REBUY when PnL <= -rebuyThresholdPct', () => {
        const pos = { ...basePos, markPrice: 94, unrealisedPnl: -60 };
        const d = stateService.getPositionDecision(pos);
        expect(d.action).toBe('DCA_REBUY');
        expect(d.qty).toBe(1.5);
      });

      it('should return HOLD (loop prevention) when lastExecutionPrice exists and markPrice has not dropped enough', () => {
        const pos = {
          ...basePos, markPrice: 94, unrealisedPnl: -60,
          lastExecutionPrice: 95, lastExecutionSide: 'Buy' as const,
        };
        const d = stateService.getPositionDecision(pos);
        expect(d.action).toBe('HOLD');
        expect(d.qty).toBe(0);
      });

      it('should return DCA_REBUY when lastExecutionPrice exists and markPrice has dropped enough', () => {
        const pos = {
          ...basePos, markPrice: 90, unrealisedPnl: -100,
          lastExecutionPrice: 95, lastExecutionSide: 'Buy' as const,
        };
        const d = stateService.getPositionDecision(pos);
        expect(d.action).toBe('DCA_REBUY');
        expect(d.qty).toBe(1.5);
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('handleKeyDown should decrement on ArrowLeft', () => {
      stateService.klines.set(Array.from({ length: 10 }, (_, i) => ({
        time: i, open: 100, high: 110, low: 90, close: 100 + i, volume: 1000,
      })));
      stateService.selectedIndex.set(5);
      component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(stateService.selectedIndex()).toBe(4);
    });

    it('handleKeyDown should increment on ArrowRight', () => {
      stateService.klines.set(Array.from({ length: 10 }, (_, i) => ({
        time: i, open: 100, high: 110, low: 90, close: 100 + i, volume: 1000,
      })));
      stateService.selectedIndex.set(5);
      component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(stateService.selectedIndex()).toBe(6);
    });

    it('handleKeyDown should not go below 0', () => {
      stateService.klines.set(Array.from({ length: 10 }, (_, i) => ({
        time: i, open: 100, high: 110, low: 90, close: 100 + i, volume: 1000,
      })));
      stateService.selectedIndex.set(0);
      component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(stateService.selectedIndex()).toBe(0);
    });

    it('handleKeyDown should not exceed data length', () => {
      stateService.klines.set(Array.from({ length: 10 }, (_, i) => ({
        time: i, open: 100, high: 110, low: 90, close: 100 + i, volume: 1000,
      })));
      stateService.selectedIndex.set(9);
      component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(stateService.selectedIndex()).toBe(9);
    });

    it('handleKeyDown should skip when data empty', () => {
      stateService.klines.set([]);
      stateService.selectedIndex.set(5);
      component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(stateService.selectedIndex()).toBe(5);
    });

    it('handleKeyDown should skip when focused on input', () => {
      stateService.klines.set(Array.from({ length: 10 }, (_, i) => ({
        time: i, open: 100, high: 110, low: 90, close: 100 + i, volume: 1000,
      })));
      stateService.selectedIndex.set(5);
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(stateService.selectedIndex()).toBe(5);
      document.body.removeChild(input);
    });
  });
});
