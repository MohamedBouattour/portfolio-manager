export interface BotConfig {
  interval: string;
  balance: number;
  leverage: number;
  feePct: number;
  profitThresholdPct: number;
  rebuyThresholdPct: number;
  reducePct: number;
  rebuyQtyPct: number;
  maxAllocPct: number;
  stockSymbols: string[];
  dryRun?: boolean;
  manualMode?: boolean;
}
