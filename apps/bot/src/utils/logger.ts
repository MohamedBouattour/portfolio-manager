import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export class Logger {
  private capturedLogs: string[] = [];
  private isCapturing = false;

  private static getTimestamp(): string {
    return new Date().toISOString();
  }

  public startCapturing(): void {
    this.capturedLogs = [];
    this.isCapturing = true;
  }

  public saveCapturedLogs(timestamp: number): void {
    this.isCapturing = false;
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const rootDir = path.resolve(__dirname, '../../../../');
      const logsDir = path.join(rootDir, 'logs');

      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const filePath = path.join(logsDir, `${timestamp}.log`);
      fs.writeFileSync(filePath, this.capturedLogs.join('\n'), 'utf-8');
      console.log(`[SYSTEM] Captured log written to: ${filePath}`);
    } catch (err) {
      console.error('[SYSTEM] Failed to write captured logs to file', err);
    }
  }

  private write(icon: string, msg: string, data?: unknown): void {
    const formattedData = data !== undefined ? (typeof data === 'object' ? ' ' + JSON.stringify(data) : ' ' + String(data)) : '';
    const consoleMsg = `[${Logger.getTimestamp()}] ${icon} ${msg}${formattedData}`;
    
    if (icon === '✖') {
      console.error(consoleMsg);
    } else if (icon === '⚠') {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }

    if (this.isCapturing) {
      this.capturedLogs.push(consoleMsg);
    }
  }

  public info(msg: string, data?: unknown): void {
    this.write('ℹ', msg, data);
  }

  public warn(msg: string, data?: unknown): void {
    this.write('⚠', msg, data);
  }

  public error(msg: string, data?: unknown): void {
    this.write('✖', msg, data);
  }

  public ok(msg: string, data?: unknown): void {
    this.write('✔', msg, data);
  }

  public sep(): void {
    const divider = '─'.repeat(60);
    console.log(divider);
    if (this.isCapturing) {
      this.capturedLogs.push(divider);
    }
  }
}

export const log = new Logger();
