import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PiiModule } from './modules/pii.module';
import { EventsModule } from './modules/events.module';
import { PiiRecord } from './models/entities/pii-record.entity';
import { PiiAccessLog } from './models/entities/pii-access-log.entity';
import { EncryptionKey } from './models/entities/encryption-key.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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
        entities: [PiiRecord, PiiAccessLog, EncryptionKey],
        synchronize: config.get<string>('DATABASE_SYNCHRONIZE', 'false') === 'true',
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    EventsModule,
    PiiModule,
  ],
})
export class AppModule {}
