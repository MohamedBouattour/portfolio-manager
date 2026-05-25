import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AppComponent } from './app.component.js';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpTestingController } from '@angular/common/http/testing';

describe('AppComponent', () => {
  let component: AppComponent;
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
    httpMock = TestBed.inject(HttpTestingController);
    flushInitCalls();
  });

  afterEach(() => {
    httpMock.match(r => true).forEach(r => r.flush({}));
    httpMock.verify();
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('should have default signal values', () => {
    expect(component.assets()).toEqual([]);
    expect(component.searchQuery()).toBe('');
    expect(component.selectedAsset()).toBeNull();
    expect(component.klines()).toEqual([]);
    expect(component.selectedIndex()).toBeNull();
    expect(component.evaluationResult()).toBeNull();
    expect(component.isLoading()).toBe(false);
    expect(component.isEvaluating()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should compute filteredAssets', () => {
    component.assets.set(['AAPLUSDT', 'TSLAUSDT', 'NVDAUSDT']);
    expect(component.filteredAssets().length).toBe(3);
    component.searchQuery.set('aapl');
    expect(component.filteredAssets()).toEqual(['AAPLUSDT']);
  });

  it('should return all assets when searchQuery empty', () => {
    component.assets.set(['AAPLUSDT', 'TSLAUSDT']);
    expect(component.filteredAssets().length).toBe(2);
  });

  it('should compute hasScoutingSignal', () => {
    component.scoutingResults.set([{ symbol: 'AAPLUSDT', shouldEnter: true }]);
    expect(component.hasScoutingSignal('AAPLUSDT')).toBe(true);
    expect(component.hasScoutingSignal('TSLAUSDT')).toBe(false);
  });

  it('should getUptrendAssets', () => {
    component.scoutingResults.set([
      { symbol: 'AAPLUSDT', shouldEnter: true },
      { symbol: 'TSLAUSDT', shouldEnter: false },
    ]);
    expect(component.getUptrendAssets().length).toBe(1);
  });

  it('should compute selectedAssetScouting', () => {
    component.selectedAsset.set('AAPLUSDT');
    component.scoutingResults.set([{ symbol: 'AAPLUSDT', price: 150 }]);
    expect(component.selectedAssetScouting()?.symbol).toBe('AAPLUSDT');
  });

  it('getLogoColor should return HSL string', () => {
    expect(component.getLogoColor('AAPLUSDT')).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });

  it('getLogoColor should be consistent', () => {
    expect(component.getLogoColor('AAPLUSDT')).toBe(component.getLogoColor('AAPLUSDT'));
  });

  it('getLogoColor should differ for different symbols', () => {
    expect(component.getLogoColor('A')).not.toBe(component.getLogoColor('B'));
  });

  it('formatCandleDate should format timestamp', () => {
    const ts = new Date(2026, 4, 25, 14, 30, 0).getTime() / 1000;
    expect(component.formatCandleDate(ts)).toContain('2026-05-25');
  });

  it('handleKeyDown should decrement on ArrowLeft', () => {
    component.klines.set(Array.from({ length: 10 }, (_, i) => ({
      time: i, open: 100, high: 110, low: 90, close: 100 + i, volume: 1000,
    })));
    component.selectedIndex.set(5);
    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(component.selectedIndex()).toBe(4);
  });

  it('handleKeyDown should increment on ArrowRight', () => {
    component.klines.set(Array.from({ length: 10 }, (_, i) => ({
      time: i, open: 100, high: 110, low: 90, close: 100 + i, volume: 1000,
    })));
    component.selectedIndex.set(5);
    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(component.selectedIndex()).toBe(6);
  });

  it('handleKeyDown should not go below 0', () => {
    component.klines.set(Array.from({ length: 10 }, (_, i) => ({
      time: i, open: 100, high: 110, low: 90, close: 100 + i, volume: 1000,
    })));
    component.selectedIndex.set(0);
    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(component.selectedIndex()).toBe(0);
  });

  it('handleKeyDown should not exceed data length', () => {
    component.klines.set(Array.from({ length: 10 }, (_, i) => ({
      time: i, open: 100, high: 110, low: 90, close: 100 + i, volume: 1000,
    })));
    component.selectedIndex.set(9);
    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(component.selectedIndex()).toBe(9);
  });

  it('handleKeyDown should skip when data empty', () => {
    component.klines.set([]);
    component.selectedIndex.set(5);
    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(component.selectedIndex()).toBe(5);
  });

  it('handleKeyDown should skip when focused on input', () => {
    component.klines.set(Array.from({ length: 10 }, (_, i) => ({
      time: i, open: 100, high: 110, low: 90, close: 100 + i, volume: 1000,
    })));
    component.selectedIndex.set(5);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    component.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(component.selectedIndex()).toBe(5);
    document.body.removeChild(input);
  });

  it('onLogoError should add to set', () => {
    component.onLogoError('AAPL');
    expect(component.logoErrors().has('AAPL')).toBe(true);
  });

  it('fetchConfig should fetch and update config', () => {
    component.fetchConfig();
    const req = httpMock.expectOne('http://localhost:3000/api/config');
    req.flush({ timeframe: '240', manualMode: true });
    expect(component.timeframe()).toBe('4h');
    expect(component.manualMode()).toBe(true);
  });

  it('fetchOpenPositions should fetch and update positions', () => {
    component.fetchOpenPositions();
    const req = httpMock.expectOne('http://localhost:3000/api/positions');
    req.flush([{ symbol: 'BTCUSDT' }]);
    expect(component.openPositions().length).toBe(1);
  });

  it('fetchMomentum should fetch and update momentum', () => {
    component.fetchMomentum();
    const req = httpMock.expectOne('http://localhost:3000/api/momentum');
    req.flush([{ symbol: 'AAPL', price: 150, changePct: 5 }]);
    expect(component.momentumStocks().length).toBe(1);
  });

  it('fetchScoutingStatus should fetch and update', () => {
    component.fetchScoutingStatus();
    httpMock.expectOne('http://localhost:3000/api/scouting-status').flush([{ symbol: 'A' }]);
    expect(component.scoutingResults().length).toBe(1);
  });

  it('fetchLatestLog should fetch and update log', () => {
    component.fetchLatestLog();
    httpMock.expectOne('http://localhost:3000/api/logs/latest').flush({ timestamp: 1, content: 'log' });
    expect(component.latestLog()).toBe('log');
  });

  it('confirmOrder should submit order', () => {
    component.confirmOrder('BTCUSDT', 'Buy', 1, false, 3);
    const req = httpMock.expectOne('http://localhost:3000/api/execute-order');
    expect(req.request.body).toEqual({ symbol: 'BTCUSDT', side: 'Buy', qty: 1, reduceOnly: false, leverage: 3 });
    req.flush({ orderId: 'oid' });
    httpMock.match('http://localhost:3000/api/positions').forEach(r => r.flush([]));
  });

  it('getLogoUrl should return path', () => {
    expect(component.getLogoUrl('AAPL')).toBe('/logos/AAPL.png');
  });

  it('should have default sim values', () => {
    expect(component.botBalance()).toBe(689);
    expect(component.botLeverage()).toBe(3);
    expect(component.maxAllocPct()).toBe(20);
  });
});
