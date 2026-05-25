import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from './logger.js';

describe('Logger', () => {
  let logger: Logger;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    logger = new Logger();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log info messages', () => {
    logger.info('test message');
    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const call = consoleLogSpy.mock.calls[0][0];
    expect(call).toContain('ℹ');
    expect(call).toContain('test message');
  });

  it('should log warn messages to console.warn', () => {
    logger.warn('warning!');
    expect(consoleWarnSpy).toHaveBeenCalledOnce();
  });

  it('should log error messages to console.error', () => {
    logger.error('error!');
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
  });

  it('should log ok messages to console.log', () => {
    logger.ok('success!');
    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const call = consoleLogSpy.mock.calls[0][0];
    expect(call).toContain('✔');
    expect(call).toContain('success!');
  });

  it('should include timestamp in log output', () => {
    logger.info('timestamp check');
    const call = consoleLogSpy.mock.calls[0][0];
    expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
  });

  it('should append JSON data when provided', () => {
    logger.info('with data', { key: 'val' });
    const call = consoleLogSpy.mock.calls[0][0];
    expect(call).toContain('{"key":"val"}');
  });

  it('should convert non-object data to string', () => {
    logger.info('numeric', 42);
    const call = consoleLogSpy.mock.calls[0][0];
    expect(call).toContain('42');
  });

  it('should print separator line', () => {
    logger.sep();
    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const call = consoleLogSpy.mock.calls[0][0];
    expect(call).toContain('─'.repeat(60));
  });

  describe('capturing', () => {
    it('should capture logs when capturing is active', () => {
      logger.startCapturing();
      logger.info('captured msg');
      logger.ok('captured ok');
      logger.warn('captured warn');
      logger.error('captured err');

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should not capture logs when capturing is not active', () => {
      logger.info('not captured');
      const result = (logger as any).capturedLogs;
      expect(result.length).toBe(0);
    });
  });
});
