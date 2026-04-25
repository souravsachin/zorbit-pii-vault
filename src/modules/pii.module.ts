import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// PassportModule + JwtModule + local JwtStrategy removed in SDK-0.5.0
// migration. ZorbitAuthModule.forRoot() at AppModule level now owns
// all auth wiring globally. See 00_docs/platform/sdk-di-factory-design.md.
import { PiiController } from '../controllers/pii.controller';
import { TokenizationService } from '../services/tokenization.service';
import { DetokenizationService } from '../services/detokenization.service';
import { EncryptionService } from '../services/encryption.service';
import { AuditService } from '../services/audit.service';
import { HashIdService } from '../services/hash-id.service';
import { EventConsumerService } from '../events/event-consumer.service';
import { PiiRecord } from '../models/entities/pii-record.entity';
import { PiiAccessLog } from '../models/entities/pii-access-log.entity';
import { EncryptionKey } from '../models/entities/encryption-key.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PiiRecord, PiiAccessLog, EncryptionKey]),
  ],
  controllers: [PiiController],
  providers: [
    TokenizationService,
    DetokenizationService,
    EncryptionService,
    AuditService,
    HashIdService,
    EventConsumerService,
  ],
  exports: [TokenizationService, DetokenizationService, EncryptionService],
})
export class PiiModule {}
