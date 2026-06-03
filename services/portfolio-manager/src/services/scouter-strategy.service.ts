import { Injectable } from '@nestjs/common';
import axios from 'axios';

const SCOUTER_URL = process.env.MARKET_SCOUTER_URL || 'http://localhost:3002';

@Injectable()
export class ScouterStrategyService {
  async evaluate(closes: number[], index: number, position?: any, config?: any): Promise<any> {
    const res = await axios.post(`${SCOUTER_URL}/api/evaluate`, {
      closes,
      index,
      position,
      config,
    });
    return res.data;
  }

  async getScoutingStatus(): Promise<any[]> {
    const res = await axios.get(`${SCOUTER_URL}/api/scouting-status`);
    return res.data;
  }
}
