import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Traverses up from process.cwd() to find and load the root .env file
function loadEnv() {
  let dir = process.cwd();
  while (dir) {
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Try fallback in cwd
  dotenv.config();
}
loadEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Allow Angular frontend
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`[NestJS] Backend running on http://localhost:${port}`);
}
bootstrap();
