import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZorbitAuthModule } from '@zorbit-platform/sdk-node';
import { PiiModule } from './modules/pii.module';
import { EventsModule } from './modules/events.module';
import { VisibilityModule } from './visibility/visibility.module';
import { PiiRecord } from './models/entities/pii-record.entity';
import { PiiAccessLog } from './models/entities/pii-access-log.entity';
import { EncryptionKey } from './models/entities/encryption-key.entity';
import { VisibilityPolicy } from './visibility/entities/visibility-policy.entity';
import { PiiNickname } from './visibility/entities/pii-nickname.entity';
import { HealthController } from './controllers/health.controller';
import { SeedModule } from './seed/seed.module';
import { ModuleAnnouncementService } from './events/module-announcement.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // EPIC-9 / SDK 0.5.0 — single-line auth wiring. Replaces per-feature
    // PassportModule.register() + JwtModule.registerAsync() + local
    // JwtStrategy. See 00_docs/platform/sdk-di-factory-design.md.
    ZorbitAuthModule.forRoot({
      jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DATABASE_HOST', 'localhost'),
        port: config.get<number>('DATABASE_PORT', 5437),
        database: config.get<string>('DATABASE_NAME', 'zorbit_pii_vault'),
        username: config.get<string>('DATABASE_USER', 'zorbit'),
        password: config.get<string>('DATABASE_PASSWORD', 'zorbit_dev'),
        entities: [PiiRecord, PiiAccessLog, EncryptionKey, VisibilityPolicy, PiiNickname],
        synchronize: config.get<string>('DATABASE_SYNCHRONIZE', 'false') === 'true',
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    EventsModule,
    PiiModule,
    VisibilityModule,
    SeedModule,
  ],
  controllers: [HealthController],
  providers: [ModuleAnnouncementService],
})
export class AppModule {}
