import { Controller, Get, Post, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { BybitRestService } from '../services/bybit-rest.service.js';

@Controller('api')
export class ConnectorController {
  constructor(private readonly bybitRestService: BybitRestService) {}

  @Get('klines')
  async getKlines(
    @Query('symbol') symbol: string,
    @Query('interval') interval: string,
    @Query('limit') limit: string
  ) {
    if (!symbol) {
      throw new HttpException('Symbol parameter is required', HttpStatus.BAD_REQUEST);
    }
    const limitNum = parseInt(limit || '200', 10);
    try {
      const klines = await this.bybitRestService.getKlines(symbol, interval || '240', limitNum);
      return klines;
    } catch (err: any) {
      throw new HttpException(err.message || 'Error fetching klines', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('symbols')
  async getSymbols(@Query('type') _type: string) {
    // Only support 'stock' type as per target spec
    try {
      const symbols = await this.bybitRestService.getActiveStockSymbols();
      return symbols;
    } catch (err: any) {
      throw new HttpException(err.message || 'Error fetching active stock symbols', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('instrument')
  async getInstrument(@Query('symbol') symbol: string) {
    if (!symbol) {
      throw new HttpException('Symbol parameter is required', HttpStatus.BAD_REQUEST);
    }
    try {
      const spec = await this.bybitRestService.getInstrumentSpec(symbol);
      if (!spec) {
        throw new HttpException('Instrument not found', HttpStatus.NOT_FOUND);
      }
      return spec;
    } catch (err: any) {
      throw new HttpException(err.message || 'Error fetching instrument spec', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('balance')
  async getBalance() {
    try {
      const balance = await this.bybitRestService.getWalletBalance();
      if (!balance) {
        throw new HttpException('Failed to fetch wallet balance', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return balance;
    } catch (err: any) {
      throw new HttpException(err.message || 'Error fetching balance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('positions')
  async getPositions() {
    try {
      const positions = await this.bybitRestService.getOpenPositions();
      return positions;
    } catch (err: any) {
      throw new HttpException(err.message || 'Error fetching positions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('executions')
  async getExecutions(
    @Query('symbol') symbol: string,
    @Query('limit') limit?: string
  ) {
    if (!symbol) {
      throw new HttpException('Symbol parameter is required', HttpStatus.BAD_REQUEST);
    }
    const limitNum = parseInt(limit || '50', 10);
    try {
      const result = await this.bybitRestService.getExecutions(symbol, limitNum);
      return result;
    } catch (err: any) {
      throw new HttpException(err.message || 'Error fetching executions', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('order')
  async postOrder(
    @Body()
    body: {
      symbol: string;
      side: 'Buy' | 'Sell';
      qty: number;
      reduceOnly?: boolean;
    }
  ) {
    const { symbol, side, qty, reduceOnly } = body;
    if (!symbol || !side || !qty) {
      throw new HttpException('Missing required order parameters', HttpStatus.BAD_REQUEST);
    }
    try {
      const result = await this.bybitRestService.submitOrder({
        symbol,
        side,
        qty,
        reduceOnly: !!reduceOnly,
      });
      if (!result) {
        throw new HttpException('Order placement failed', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return result;
    } catch (err: any) {
      throw new HttpException(err.message || 'Order error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('leverage')
  async postLeverage(
    @Body()
    body: {
      symbol: string;
      leverage: number;
    }
  ) {
    const { symbol, leverage } = body;
    if (!symbol || leverage === undefined) {
      throw new HttpException('Missing symbol or leverage parameters', HttpStatus.BAD_REQUEST);
    }
    try {
      const success = await this.bybitRestService.setLeverage(symbol, leverage);
      return { success };
    } catch (err: any) {
      throw new HttpException(err.message || 'Leverage error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

@Controller('')
export class HealthController {
  @Get('health')
  getHealth() {
    return { status: 'ok', service: 'bybit-connector' };
  }
}
