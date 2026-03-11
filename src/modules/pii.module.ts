import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PiiController } from '../controllers/pii.controller';
import { TokenizationService } from '../services/tokenization.service';
import { DetokenizationService } from '../services/detokenization.service';
import { EncryptionService } from '../services/encryption.service';
import { AuditService } from '../services/audit.service';
import { HashIdService } from '../services/hash-id.service';
import { EventConsumerService } from '../events/event-consumer.service';
import { JwtStrategy } from '../middleware/jwt.strategy';
import { PiiRecord } from '../models/entities/pii-record.entity';
import { PiiAccessLog } from '../models/entities/pii-access-log.entity';
import { EncryptionKey } from '../models/entities/encryption-key.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PiiRecord, PiiAccessLog, EncryptionKey]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret-change-in-production'),
      }),
    }),
  ],
  controllers: [PiiController],
  providers: [
    TokenizationService,
    DetokenizationService,
    EncryptionService,
    AuditService,
    HashIdService,
    EventConsumerService,
    JwtStrategy,
  ],
  exports: [TokenizationService, DetokenizationService, EncryptionService],
})
export class PiiModule {}
