import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the bot directory if present
dotenv.config({ path: path.resolve(process.cwd(), '../bot/.env') });
dotenv.config(); // Also load from current folder

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Allow Angular frontend
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`[NestJS] Backend running on http://localhost:${port}`);
}
bootstrap();
