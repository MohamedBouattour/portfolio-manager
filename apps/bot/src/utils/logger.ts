export class Logger {
  private static getTimestamp(): string {
    return new Date().toISOString();
  }

  public info(msg: string, data?: unknown): void {
    console.log(`[${Logger.getTimestamp()}] ℹ  ${msg}`, data !== undefined ? data : '');
  }

  public warn(msg: string, data?: unknown): void {
    console.warn(`[${Logger.getTimestamp()}] ⚠  ${msg}`, data !== undefined ? data : '');
  }

  public error(msg: string, data?: unknown): void {
    console.error(`[${Logger.getTimestamp()}] ✖  ${msg}`, data !== undefined ? data : '');
  }

  public ok(msg: string, data?: unknown): void {
    console.log(`[${Logger.getTimestamp()}] ✔  ${msg}`, data !== undefined ? data : '');
  }

  public sep(): void {
    console.log('─'.repeat(60));
  }
}

export const log = new Logger();
