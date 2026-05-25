import { CFG } from './config.js';
import { BybitAdapter } from './adapters/bybit.js';
import { MACDStrategy } from './strategies/MACDStrategy.js';
import { TradingEngine } from './services/TradingEngine.js';
import { log } from './utils/logger.js';

async function main(): Promise<void> {
  const start = Date.now();
  const timestamp = start;
  log.startCapturing();

  log.sep();
  log.info('🚀 Scalable Stock-Token Trading Bot Starting...');
  const friendlyInterval = CFG.interval === 'D' ? '1D' : CFG.interval === '240' ? '4h' : CFG.interval === '60' ? '1h' : CFG.interval;
  log.info(`Target interval: ${friendlyInterval} (${CFG.interval} Minutes/Resolution)`);

  // 1. Instantiate Adapter (can easily swap to other adapters in the future)
  const exchangeAdapter = new BybitAdapter(CFG.apiKey, CFG.secretKey);

  // 2. Instantiate Strategy (can easily swap to other strategies in the future)
  const tradingStrategy = new MACDStrategy(12, 26, 9);

  // 3. Instantiate Engine with dependency injection
  const engine = new TradingEngine(exchangeAdapter, CFG, tradingStrategy);

  // 4. Run cycle
  await engine.run();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log.sep();
  log.ok(`Execution run complete in ${elapsed} seconds.`);

  log.saveCapturedLogs(timestamp);
}

main().catch((err) => {
  log.error('Fatal execution crash', err);
  process.exit(1);
});
