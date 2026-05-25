import { RestClientV5 } from 'bybit-api';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.API_KEY || '';
const secretKey = process.env.SECRET_KEY || '';

const client = new RestClientV5({
  key: apiKey,
  secret: secretKey,
  testnet: false,
  recv_window: 60_000,
  enable_time_sync: true,
});

async function test() {
  try {
    const resUnified = await client.getWalletBalance({
      accountType: 'UNIFIED'
    });
    console.log('Unified Result without coin:', JSON.stringify(resUnified, null, 2));
  } catch (err) {
    console.error('Unified Error:', err);
  }
}

test();
