import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PiiRecord } from '../models/entities/pii-record.entity';
import { PiiAccessLog } from '../models/entities/pii-access-log.entity';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([PiiRecord, PiiAccessLog])],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
