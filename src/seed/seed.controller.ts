import { Controller, Post, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { SeedService } from './seed.service';

@Controller('api/v1/G/pii_vault/seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  seedSystem(): Promise<Record<string, unknown>> {
    return this.seedService.seedSystem();
  }

  @Post('demo')
  @HttpCode(HttpStatus.OK)
  seedDemo(): Promise<Record<string, unknown>> {
    return this.seedService.seedDemo();
  }

  @Delete('demo')
  @HttpCode(HttpStatus.OK)
  flushDemo(): Promise<Record<string, unknown>> {
    return this.seedService.flushDemo();
  }

  @Delete('all')
  @HttpCode(HttpStatus.OK)
  flushAll(): Promise<Record<string, unknown>> {
    return this.seedService.flushAll();
  }
}
