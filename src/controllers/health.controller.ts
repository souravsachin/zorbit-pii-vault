import { Controller, Get } from '@nestjs/common';

@Controller('api/v1/G/health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'zorbit-pii-vault',
      timestamp: new Date().toISOString(),
    };
  }
}
