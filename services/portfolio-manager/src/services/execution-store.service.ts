import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

interface ExecutionRecord {
  lastExecutionPrice: number;
  lastExecutionSide: 'Buy' | 'Sell';
  updatedAt: number;
}

@Injectable()
export class ExecutionStoreService {
  private store = new Map<string, ExecutionRecord>();
  private readonly filePath: string;

  constructor() {
    const root = this.findWorkspaceRoot();
    this.filePath = path.join(root, 'execution-store.json');
    this.load();
  }

  private findWorkspaceRoot(): string {
    let currentDir = process.cwd();
    while (currentDir) {
      if (fs.existsSync(path.join(currentDir, 'package.json'))) {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(currentDir, 'package.json'), 'utf8'));
          if (pkg.name === 'bybit-monorepo') {
            return currentDir;
          }
        } catch (_e) {}
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break;
      currentDir = parent;
    }
    return process.cwd();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const data = JSON.parse(raw);
        for (const [symbol, record] of Object.entries(data)) {
          this.store.set(symbol, record as ExecutionRecord);
        }
        console.log(`[ExecutionStore] Loaded ${this.store.size} execution record(s) from ${this.filePath}`);
      }
    } catch (err) {
      console.error('[ExecutionStore] Failed to load execution store:', err);
    }
  }

  private save(): void {
    try {
      const data: Record<string, ExecutionRecord> = {};
      for (const [symbol, record] of this.store) {
        data[symbol] = record;
      }
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[ExecutionStore] Failed to save execution store:', err);
    }
  }

  set(symbol: string, price: number, side: 'Buy' | 'Sell'): void {
    this.store.set(symbol, {
      lastExecutionPrice: price,
      lastExecutionSide: side,
      updatedAt: Date.now(),
    });
    this.save();
  }

  get(symbol: string): ExecutionRecord | undefined {
    return this.store.get(symbol);
  }

  getAll(): Map<string, ExecutionRecord> {
    return new Map(this.store);
  }

  delete(symbol: string): void {
    this.store.delete(symbol);
    this.save();
  }
}
