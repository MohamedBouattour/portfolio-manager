import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

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
  dotenv.config();
}
loadEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = process.env.PORT || 3003;
  await app.listen(port);
  console.log(`[portfolio-manager] Running on http://localhost:${port}`);
}
bootstrap();
