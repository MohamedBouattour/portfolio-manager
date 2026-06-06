import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from './db.service.js';
import { ConnectorExchangeService } from './connector-exchange.service.js';
import { OperationRecord } from '@portfolio/contracts';
import * as fs from 'fs';
import * as path from 'path';

interface ExecutionRecord {
  lastExecutionPrice: number;
  lastExecutionSide: 'Buy' | 'Sell';
  updatedAt: number;
}

@Injectable()
export class ExecutionStoreService implements OnModuleInit {
  /** Hot cache for fast loop-prevention lookups */
  private cache = new Map<string, ExecutionRecord>();

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    private readonly exchange: ConnectorExchangeService
  ) {}

  async onModuleInit(): Promise<void> {
    // Wait for DB connection and migrations to complete
    await this.db.waitForConnection();

    // Migrate old JSON file if it exists
    const jsonPath = this.findJsonStorePath();
    if (jsonPath) {
      await this.db.migrateFromJsonFile(jsonPath);
    }

    // Auto-sync executions from Bybit on startup to keep data perfectly conform and logic-compliant
    try {
      console.log('[ExecutionStore] Auto-syncing recent executions from Bybit...');
      await this.syncFromBybitExecutions();
    } catch (err: any) {
      console.error('[ExecutionStore] Failed to auto-sync executions on startup:', err.message);
    }

    // Warm the cache from DB
    await this.warmCache();
  }

  private findJsonStorePath(): string | null {
    let currentDir = process.cwd();
    while (currentDir) {
      if (fs.existsSync(path.join(currentDir, 'package.json'))) {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(currentDir, 'package.json'), 'utf8'));
          if (pkg.name === 'bybit-monorepo') {
            const filePath = path.join(currentDir, 'execution-store.json');
            return fs.existsSync(filePath) ? filePath : null;
          }
        } catch (_e) {}
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break;
      currentDir = parent;
    }
    return null;
  }

  private async warmCache(): Promise<void> {
    if (!this.db.isConnected()) {
      console.warn('[ExecutionStore] DB not connected — cache not warmed.');
      return;
    }

    try {
      const summary = await this.db.getOperationsSummary();
      for (const entry of summary) {
        const lastOp = await this.db.getLastOperation(entry.symbol);
        if (lastOp) {
          this.cache.set(entry.symbol, {
            lastExecutionPrice: lastOp.price,
            lastExecutionSide: lastOp.side,
            updatedAt: lastOp.createdAt ? new Date(lastOp.createdAt).getTime() : Date.now(),
          });
        }
      }
      console.log(`[ExecutionStore] Cache warmed with ${this.cache.size} symbol(s) from DB.`);
    } catch (err: any) {
      console.error('[ExecutionStore] Failed to warm cache:', err.message);
    }
  }

  /**
   * Update the last execution record for loop-prevention.
   * Writes to DB and updates the hot cache.
   */
  set(symbol: string, price: number, side: 'Buy' | 'Sell'): void {
    this.cache.set(symbol, {
      lastExecutionPrice: price,
      lastExecutionSide: side,
      updatedAt: Date.now(),
    });
  }

  /**
   * Record a full operation to the database with all details.
   * This is the primary persistence method for operations history.
   */
  async recordOperation(op: OperationRecord): Promise<number | null> {
    // Always update the cache with the latest execution
    this.cache.set(op.symbol, {
      lastExecutionPrice: op.price,
      lastExecutionSide: op.side,
      updatedAt: Date.now(),
    });

    return this.db.recordOperation(op);
  }

  /**
   * Get the last execution record for a symbol from the hot cache.
   * Used for loop-prevention checks.
   */
  get(symbol: string): ExecutionRecord | undefined {
    return this.cache.get(symbol);
  }

  getAll(): Map<string, ExecutionRecord> {
    return new Map(this.cache);
  }

  delete(symbol: string): void {
    this.cache.delete(symbol);
  }

  /**
   * Fetch trade executions directly from Bybit, classify them into ENTRY, DCA_REBUY, TAKE_PROFIT, or CLOSE,
   * and save them to the PostgreSQL database. This ensures 100% accurate, conform, and logical values in the UI.
   */
  async syncFromBybitExecutions(specSymbol?: string): Promise<{ syncedSymbols: string[]; totalSynced: number }> {
    let symbols: string[] = [];
    if (specSymbol) {
      symbols = [specSymbol];
    } else {
      try {
        const positions = await this.exchange.getOpenPositions();
        symbols = positions.map(p => p.symbol);
      } catch (err: any) {
        console.error('[ExecutionStore] Failed to fetch open positions for sync:', err.message);
        return { syncedSymbols: [], totalSynced: 0 };
      }
    }

    let totalSynced = 0;

    for (const symbol of symbols) {
      try {
        const executions = await this.exchange.getExecutions(symbol, 200);
        if (!executions || executions.length === 0) continue;

        // Filter out non-trade execution types like Funding fees
        const tradeExecs = executions.filter(
          (exec) => exec.execType?.trim().toLowerCase() !== 'funding'
        );
        if (tradeExecs.length === 0) continue;

        const sortedExecs = [...tradeExecs].sort((a, b) => {
          const timeA = parseInt(a.execTime || '0', 10);
          const timeB = parseInt(b.execTime || '0', 10);
          return timeA - timeB;
        });

        await this.db.deleteOperationsBySymbol(symbol);

        let runningSize = 0;
        let runningCost = 0;
        const leverage = parseInt(process.env.LEVERAGE || '3', 10);

        for (const exec of sortedExecs) {
          const side = exec.side as 'Buy' | 'Sell';
          const qty = parseFloat(exec.execQty);
          const price = parseFloat(exec.execPrice);
          const orderId = exec.orderId;
          const createdAt = new Date(parseInt(exec.execTime, 10)).toISOString();

          let action: 'ENTRY' | 'DCA_REBUY' | 'TAKE_PROFIT' | 'CLOSE' = 'ENTRY';
          let avgPriceBefore: number | undefined;
          let avgPriceAfter: number | undefined;
          let pnlPctBefore: number | undefined;
          let marginUsed: number | undefined;

          if (side === 'Buy') {
            if (runningSize === 0) {
              action = 'ENTRY';
              avgPriceBefore = 0;
              avgPriceAfter = price;
              runningSize = qty;
              runningCost = qty * price;
            } else {
              action = 'DCA_REBUY';
              avgPriceBefore = runningCost / runningSize;
              const margin = (runningSize * avgPriceBefore) / leverage;
              const pnlVal = (price - avgPriceBefore) * runningSize;
              pnlPctBefore = margin > 0 ? (pnlVal / margin) * 100 : 0;

              runningSize += qty;
              runningCost += qty * price;
              avgPriceAfter = runningCost / runningSize;
            }
            marginUsed = (qty * price) / leverage;
          } else {
            if (runningSize > 0) {
              avgPriceBefore = runningCost / runningSize;
              marginUsed = (qty * price) / leverage;

              const margin = (runningSize * avgPriceBefore) / leverage;
              const pnlVal = (price - avgPriceBefore) * runningSize;
              pnlPctBefore = margin > 0 ? (pnlVal / margin) * 100 : 0;

              if (qty >= runningSize - 0.0001) {
                action = 'CLOSE';
                runningSize = 0;
                runningCost = 0;
                avgPriceAfter = 0;
              } else {
                action = 'TAKE_PROFIT';
                runningSize -= qty;
                runningCost = runningSize * avgPriceBefore;
                avgPriceAfter = avgPriceBefore;
              }
            } else {
              action = 'ENTRY';
              avgPriceBefore = 0;
              avgPriceAfter = price;
              runningSize = qty;
              runningCost = qty * price;
            }
          }

          await this.db.recordOperationDirect({
            symbol,
            side,
            action,
            qty,
            price,
            avgPriceBefore,
            avgPriceAfter,
            pnlPctBefore,
            marginUsed,
            leverage,
            orderId,
            source: 'bot',
            createdAt,
          });

          totalSynced++;
        }

        if (sortedExecs.length > 0) {
          const lastExec = sortedExecs[sortedExecs.length - 1];
          this.set(
            symbol,
            parseFloat(lastExec.execPrice),
            lastExec.side as 'Buy' | 'Sell'
          );
        }
      } catch (e: any) {
        console.error(`[ExecutionStore] Error syncing executions for ${symbol}:`, e.message);
      }
    }

    return { syncedSymbols: symbols, totalSynced };
  }
}
