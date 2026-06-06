import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { OperationRecord } from '@portfolio/contracts';

const { Pool } = pg;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS operations (
  id               SERIAL PRIMARY KEY,
  symbol           VARCHAR(32) NOT NULL,
  side             VARCHAR(4)  NOT NULL CHECK (side IN ('Buy', 'Sell')),
  action           VARCHAR(20) NOT NULL,
  qty              NUMERIC(18,8) NOT NULL,
  price            NUMERIC(18,8) NOT NULL,
  avg_price_before NUMERIC(18,8),
  avg_price_after  NUMERIC(18,8),
  pnl_pct_before   NUMERIC(10,4),
  pnl_pct_after    NUMERIC(10,4),
  margin_used      NUMERIC(18,8),
  leverage         NUMERIC(6,2),
  order_id         VARCHAR(64),
  source           VARCHAR(16) NOT NULL DEFAULT 'bot',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operations_symbol     ON operations (symbol);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operations_sym_side   ON operations (symbol, side, created_at DESC);
`;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: pg.Pool;
  private connected = false;
  private connectionPromise: Promise<void>;
  private resolveConnection!: () => void;

  constructor() {
    this.connectionPromise = new Promise((resolve) => {
      this.resolveConnection = resolve;
    });

    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://portfolio:portfolio@localhost:5433/portfolio';

    this.pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    this.pool.on('error', (err) => {
      console.error('[DatabaseService] Unexpected pool error:', err.message);
    });
  }

  async waitForConnection(): Promise<void> {
    return this.connectionPromise;
  }

  async onModuleInit(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query(SCHEMA_SQL);
      client.release();
      this.connected = true;
      console.log('[DatabaseService] Connected to PostgreSQL and schema initialized.');
      this.resolveConnection();
    } catch (err: any) {
      console.error('[DatabaseService] Failed to connect to PostgreSQL:', err.message);
      console.warn('[DatabaseService] Operating in degraded mode — operations will not be persisted.');
      this.resolveConnection();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
    console.log('[DatabaseService] Pool closed.');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async recordOperation(op: OperationRecord): Promise<number | null> {
    if (!this.connected) {
      console.warn('[DatabaseService] DB not connected — operation not recorded:', op.symbol, op.action);
      return null;
    }

    try {
      const result = await this.pool.query(
        `INSERT INTO operations
          (symbol, side, action, qty, price, avg_price_before, avg_price_after,
           pnl_pct_before, pnl_pct_after, margin_used, leverage, order_id, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [
          op.symbol,
          op.side,
          op.action,
          op.qty,
          op.price,
          op.avgPriceBefore ?? null,
          op.avgPriceAfter ?? null,
          op.pnlPctBefore ?? null,
          op.pnlPctAfter ?? null,
          op.marginUsed ?? null,
          op.leverage ?? null,
          op.orderId ?? null,
          op.source,
        ]
      );
      return result.rows[0]?.id ?? null;
    } catch (err: any) {
      console.error('[DatabaseService] Failed to record operation:', err.message);
      return null;
    }
  }

  async deleteOperationsBySymbol(symbol: string): Promise<void> {
    if (!this.connected) return;
    try {
      await this.pool.query('DELETE FROM operations WHERE symbol = $1', [symbol]);
    } catch (err: any) {
      console.error('[DatabaseService] Failed to delete operations by symbol:', err.message);
    }
  }

  async recordOperationDirect(op: OperationRecord & { createdAt: string }): Promise<number | null> {
    if (!this.connected) return null;
    try {
      const result = await this.pool.query(
        `INSERT INTO operations
          (symbol, side, action, qty, price, avg_price_before, avg_price_after,
           pnl_pct_before, pnl_pct_after, margin_used, leverage, order_id, source, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id`,
        [
          op.symbol,
          op.side,
          op.action,
          op.qty,
          op.price,
          op.avgPriceBefore ?? null,
          op.avgPriceAfter ?? null,
          op.pnlPctBefore ?? null,
          op.pnlPctAfter ?? null,
          op.marginUsed ?? null,
          op.leverage ?? null,
          op.orderId ?? null,
          op.source,
          op.createdAt,
        ]
      );
      return result.rows[0]?.id ?? null;
    } catch (err: any) {
      console.error('[DatabaseService] Failed to record operation direct:', err.message);
      return null;
    }
  }

  async getLastOperation(
    symbol: string,
    side?: 'Buy' | 'Sell'
  ): Promise<OperationRecord | null> {
    if (!this.connected) return null;

    try {
      const query = side
        ? `SELECT * FROM operations WHERE symbol = $1 AND side = $2 ORDER BY created_at DESC LIMIT 1`
        : `SELECT * FROM operations WHERE symbol = $1 ORDER BY created_at DESC LIMIT 1`;
      const params = side ? [symbol, side] : [symbol];
      const result = await this.pool.query(query, params);
      return result.rows.length > 0 ? this.rowToRecord(result.rows[0]) : null;
    } catch (err: any) {
      console.error('[DatabaseService] Failed to get last operation:', err.message);
      return null;
    }
  }

  async getOperationsBySymbol(
    symbol: string,
    limit = 50
  ): Promise<OperationRecord[]> {
    if (!this.connected) return [];

    try {
      const result = await this.pool.query(
        `SELECT * FROM operations WHERE symbol = $1 ORDER BY created_at DESC LIMIT $2`,
        [symbol, limit]
      );
      return result.rows.map((r: any) => this.rowToRecord(r));
    } catch (err: any) {
      console.error('[DatabaseService] Failed to get operations by symbol:', err.message);
      return [];
    }
  }

  async getAllRecentOperations(limit = 100): Promise<OperationRecord[]> {
    if (!this.connected) return [];

    try {
      const result = await this.pool.query(
        `SELECT * FROM operations ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );
      return result.rows.map((r: any) => this.rowToRecord(r));
    } catch (err: any) {
      console.error('[DatabaseService] Failed to get recent operations:', err.message);
      return [];
    }
  }

  async getOperationsSummary(): Promise<
    {
      symbol: string;
      totalOps: number;
      dcaCount: number;
      tpCount: number;
      entryCount: number;
      lastActionTime: string;
      lastAction: string;
    }[]
  > {
    if (!this.connected) return [];

    try {
      const result = await this.pool.query(`
        SELECT
          symbol,
          COUNT(*)::int AS total_ops,
          COUNT(*) FILTER (WHERE action = 'DCA_REBUY')::int AS dca_count,
          COUNT(*) FILTER (WHERE action = 'TAKE_PROFIT')::int AS tp_count,
          COUNT(*) FILTER (WHERE action = 'ENTRY')::int AS entry_count,
          MAX(created_at) AS last_action_time,
          (SELECT action FROM operations o2
           WHERE o2.symbol = operations.symbol
           ORDER BY o2.created_at DESC LIMIT 1) AS last_action
        FROM operations
        GROUP BY symbol
        ORDER BY MAX(created_at) DESC
      `);
      return result.rows.map((r: any) => ({
        symbol: r.symbol,
        totalOps: r.total_ops,
        dcaCount: r.dca_count,
        tpCount: r.tp_count,
        entryCount: r.entry_count,
        lastActionTime: r.last_action_time,
        lastAction: r.last_action,
      }));
    } catch (err: any) {
      console.error('[DatabaseService] Failed to get operations summary:', err.message);
      return [];
    }
  }

  async migrateFromJsonFile(filePath: string): Promise<void> {
    if (!this.connected) return;

    try {
      const fs = await import('fs');
      if (!fs.existsSync(filePath)) {
        console.log('[DatabaseService] No execution-store.json found — nothing to migrate.');
        return;
      }

      // Check if we already have data
      const existing = await this.pool.query('SELECT COUNT(*)::int AS count FROM operations');
      if (existing.rows[0].count > 0) {
        console.log('[DatabaseService] Operations table already has data — skipping migration.');
        return;
      }

      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      let migrated = 0;

      for (const [symbol, record] of Object.entries<any>(data)) {
        await this.recordOperation({
          symbol,
          side: record.lastExecutionSide || 'Buy',
          action: record.lastExecutionSide === 'Sell' ? 'TAKE_PROFIT' : 'ENTRY',
          qty: 0, // Unknown from old format
          price: record.lastExecutionPrice || 0,
          source: 'bot',
        });
        migrated++;
      }

      console.log(`[DatabaseService] Migrated ${migrated} record(s) from execution-store.json.`);
    } catch (err: any) {
      console.error('[DatabaseService] Migration from JSON failed:', err.message);
    }
  }

  private rowToRecord(row: any): OperationRecord {
    return {
      id: row.id,
      symbol: row.symbol,
      side: row.side,
      action: row.action,
      qty: parseFloat(row.qty),
      price: parseFloat(row.price),
      avgPriceBefore: row.avg_price_before ? parseFloat(row.avg_price_before) : undefined,
      avgPriceAfter: row.avg_price_after ? parseFloat(row.avg_price_after) : undefined,
      pnlPctBefore: row.pnl_pct_before ? parseFloat(row.pnl_pct_before) : undefined,
      pnlPctAfter: row.pnl_pct_after ? parseFloat(row.pnl_pct_after) : undefined,
      marginUsed: row.margin_used ? parseFloat(row.margin_used) : undefined,
      leverage: row.leverage ? parseFloat(row.leverage) : undefined,
      orderId: row.order_id || undefined,
      source: row.source,
      createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    };
  }
}
