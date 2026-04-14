import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VisibilityController } from './visibility.controller';
import { VisibilityService } from './visibility.service';
import { VisibilityPolicy } from './entities/visibility-policy.entity';
import { PiiNickname } from './entities/pii-nickname.entity';
import { PiiRecord } from '../models/entities/pii-record.entity';
import { EncryptionKey } from '../models/entities/encryption-key.entity';
import { EncryptionService } from '../services/encryption.service';
import { HashIdService } from '../services/hash-id.service';
import { JwtStrategy } from '../middleware/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([VisibilityPolicy, PiiNickname, PiiRecord, EncryptionKey]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret-change-in-production'),
      }),
    }),
  ],
  controllers: [VisibilityController],
  providers: [
    VisibilityService,
    EncryptionService,
    HashIdService,
    JwtStrategy,
  ],
  exports: [VisibilityService],
})
export class VisibilityModule {}
