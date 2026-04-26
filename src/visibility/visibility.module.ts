import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// PassportModule + JwtModule + local JwtStrategy removed in SDK-0.5.0
// migration. ZorbitAuthModule.forRoot() at AppModule level now owns
// all auth wiring globally. See 00_docs/platform/sdk-di-factory-design.md.
import { VisibilityController } from './visibility.controller';
import { VisibilityService } from './visibility.service';
import { VisibilityPolicy } from './entities/visibility-policy.entity';
import { PiiNickname } from './entities/pii-nickname.entity';
import { PiiRecord } from '../models/entities/pii-record.entity';
import { EncryptionKey } from '../models/entities/encryption-key.entity';
import { EncryptionService } from '../services/encryption.service';
import { HashIdService } from '../services/hash-id.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VisibilityPolicy, PiiNickname, PiiRecord, EncryptionKey]),
  ],
  controllers: [VisibilityController],
  providers: [
    VisibilityService,
    EncryptionService,
    HashIdService,
  ],
  exports: [VisibilityService],
})
export class VisibilityModule {}
