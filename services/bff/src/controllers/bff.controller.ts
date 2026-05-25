import { Controller, Get, Post, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

const CONNECTOR_URL = process.env.BYBIT_CONNECTOR_URL || 'http://localhost:3001';
const SCOUTER_URL = process.env.MARKET_SCOUTER_URL || 'http://localhost:3002';
const PORTFOLIO_MANAGER_URL = process.env.PORTFOLIO_MANAGER_URL || 'http://localhost:3003';

@Controller('api')
export class BffController {
  @Get('config')
  async getConfig() {
    try {
      const res = await axios.get(`${PORTFOLIO_MANAGER_URL}/api/config`);
      return res.data;
    } catch (err: any) {
      throw new HttpException(err.response?.data || err.message, err.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('config')
  async updateConfig(@Body() body: any) {
    try {
      const res = await axios.post(`${PORTFOLIO_MANAGER_URL}/api/config`, body);
      return res.data;
    } catch (err: any) {
      throw new HttpException(err.response?.data || err.message, err.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('stocks')
  async getStocks() {
    try {
      const res = await axios.get(`${CONNECTOR_URL}/api/symbols?type=stock`);
      return res.data;
    } catch (_err: any) {
      // Fallback
      return [
        'AAPLUSDT', 'TSLAUSDT', 'NVDAUSDT', 'AMZNUSDT', 'GOOGLUSDT',
        'MSFTUSDT', 'METAUSDT', 'COINUSDT', 'MSTRUSDT', 'AMDUSDT',
        'INTCUSDT', 'PLTRUSDT', 'QQQUSDT', 'SPYUSDT', 'TSMUSDT',
      ];
    }
  }

  @Get('klines')
  async getKlines(@Query('symbol') symbol: string, @Query('interval') interval: string) {
    if (!symbol) {
      throw new HttpException('Symbol query param is required', HttpStatus.BAD_REQUEST);
    }
    try {
      const res = await axios.get(`${CONNECTOR_URL}/api/klines`, {
        params: { symbol, interval, limit: 200 }
      });
      const klines = res.data;
      if (!Array.isArray(klines)) {
        throw new HttpException('Failed to fetch klines', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return klines.map((k: any) => ({
        ...k,
        time: k.time / 1000,
      }));
    } catch (err: any) {
      throw new HttpException(err.response?.data || err.message, err.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('balance')
  async getBalance() {
    try {
      const res = await axios.get(`${PORTFOLIO_MANAGER_URL}/api/balance`);
      return res.data;
    } catch (err: any) {
      throw new HttpException(err.response?.data || err.message, err.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('positions')
  async getPositions() {
    try {
      const res = await axios.get(`${PORTFOLIO_MANAGER_URL}/api/positions`);
      return res.data;
    } catch (err: any) {
      throw new HttpException(err.response?.data || err.message, err.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('scouting-status')
  async getScoutingStatus() {
    try {
      const res = await axios.get(`${SCOUTER_URL}/api/scouting-status`);
      return res.data;
    } catch (err: any) {
      throw new HttpException(err.response?.data || err.message, err.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('momentum')
  async getMomentum() {
    try {
      const res = await axios.get(`${SCOUTER_URL}/api/momentum`);
      return res.data;
    } catch (err: any) {
      throw new HttpException(err.response?.data || err.message, err.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('logs/latest')
  async getLatestLog() {
    try {
      const res = await axios.get(`${PORTFOLIO_MANAGER_URL}/api/logs/latest`);
      return res.data;
    } catch (err: any) {
      throw new HttpException(err.response?.data || err.message, err.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('evaluate')
  async evaluate(@Body() body: any) {
    try {
      const res = await axios.post(`${SCOUTER_URL}/api/evaluate`, body);
      return res.data;
    } catch (err: any) {
      throw new HttpException(err.response?.data || err.message, err.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('execute-order')
  async executeOrder(@Body() body: any) {
    try {
      const res = await axios.post(`${PORTFOLIO_MANAGER_URL}/api/execute-order`, body);
      return res.data;
    } catch (err: any) {
      throw new HttpException(err.response?.data || err.message, err.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('run-cycle')
  async runCycle() {
    try {
      const res = await axios.post(`${PORTFOLIO_MANAGER_URL}/api/run-cycle`);
      return res.data;
    } catch (err: any) {
      throw new HttpException(err.response?.data || err.message, err.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

@Controller('')
export class HealthController {
  @Get('health')
  getHealth() {
    return { status: 'ok', service: 'bff' };
  }
}
