import * as fs from 'fs';
import * as path from 'path';

export function getWorkspaceRoot(): string {
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

export function getLogsDir(): string {
  const root = getWorkspaceRoot();
  return path.join(root, 'logs');
}

export function getTimeframeConfigPath(): string {
  return path.join(getWorkspaceRoot(), 'timeframe-config.json');
}

export function getTimeframe(): string {
  const configPath = getTimeframeConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config && config.timeframe) {
        return config.timeframe;
      }
    } catch (_e) {}
  }
  return process.env.TIME_FRAME || '240';
}

export function setTimeframe(tf: string): void {
  const configPath = getTimeframeConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const config = { timeframe: tf };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

