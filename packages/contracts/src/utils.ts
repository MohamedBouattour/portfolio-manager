import * as fs from 'fs';
import * as path from 'path';

export function getLogsDir(): string {
  let currentDir = process.cwd();
  while (currentDir) {
    const candidate = path.join(currentDir, 'logs');
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(currentDir, 'package.json'), 'utf8'));
        if (pkg.name === 'bybit-monorepo') {
          return candidate;
        }
      } catch (_e) {}
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  return path.join(process.cwd(), 'logs');
}
