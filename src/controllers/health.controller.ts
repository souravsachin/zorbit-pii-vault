import { Controller, Get } from '@nestjs/common';
import { Public } from '../middleware/decorators';

@Controller('api/v1/G')
export class HealthController {
  @Get('health')
  @Public()
  check() {
    return {
      status: 'ok',
      service: 'zorbit-pii-vault',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('manifest')
  @Public()
  getManifest(): Record<string, unknown> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../../zorbit-module-manifest.json');
  }
}
