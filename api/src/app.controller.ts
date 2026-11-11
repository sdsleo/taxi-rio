import { Controller, Get } from '@nestjs/common';
import { IHealthStatus } from '@taxi-rio/shared';

@Controller()
export class AppController {
  @Get('health')
  getHealth(): IHealthStatus {
    return {
      status: 'ok',
      service: 'taxi-rio-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
