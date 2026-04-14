import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PiiRecord, PiiDataType } from '../models/entities/pii-record.entity';
import { PiiAccessLog } from '../models/entities/pii-access-log.entity';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(PiiRecord)
    private readonly piiRecordRepo: Repository<PiiRecord>,
    @InjectRepository(PiiAccessLog)
    private readonly piiAccessLogRepo: Repository<PiiAccessLog>,
  ) {}

  async seedSystem(): Promise<Record<string, unknown>> {
    const count = await this.piiRecordRepo.count({
      where: { organizationHashId: 'O-OZPY' },
    });

    if (count > 0) {
      return { seeded: 0, message: 'PII Vault already has records' };
    }

    const records: Partial<PiiRecord>[] = [
      {
        hashId: 'PII-SYS1',
        dataType: PiiDataType.EMAIL,
        encryptedValue: 'DEMO_ENCRYPTED_email_s@onezippy.ai',
        encryptionKeyId: 'KEY-DEMO',
        organizationHashId: 'O-OZPY',
        createdBy: 'U-90D3',
        expiresAt: null,
      },
      {
        hashId: 'PII-SYS2',
        dataType: PiiDataType.NAME,
        encryptedValue: 'DEMO_ENCRYPTED_Sourav_Sachin',
        encryptionKeyId: 'KEY-DEMO',
        organizationHashId: 'O-OZPY',
        createdBy: 'U-90D3',
        expiresAt: null,
      },
      {
        hashId: 'PII-SYS3',
        dataType: PiiDataType.PHONE,
        encryptedValue: 'DEMO_ENCRYPTED_+91-9876543210',
        encryptionKeyId: 'KEY-DEMO',
        organizationHashId: 'O-OZPY',
        createdBy: 'U-90D3',
        expiresAt: null,
      },
      {
        hashId: 'PII-SYS4',
        dataType: PiiDataType.DATE_OF_BIRTH,
        encryptedValue: 'DEMO_ENCRYPTED_1990-01-01',
        encryptionKeyId: 'KEY-DEMO',
        organizationHashId: 'O-OZPY',
        createdBy: 'U-90D3',
        expiresAt: null,
      },
      {
        hashId: 'PII-SYS5',
        dataType: PiiDataType.NATIONAL_ID,
        encryptedValue: 'DEMO_ENCRYPTED_AAABBB1234C',
        encryptionKeyId: 'KEY-DEMO',
        organizationHashId: 'O-OZPY',
        createdBy: 'U-90D3',
        expiresAt: null,
      },
    ];

    let seeded = 0;
    for (const record of records) {
      try {
        const entity = this.piiRecordRepo.create(record);
        await this.piiRecordRepo.save(entity);
        seeded++;
      } catch (err: unknown) {
        // Skip duplicate hashId silently
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Skipping duplicate PII record ${record.hashId}: ${message}`);
      }
    }

    this.logger.log(`Seeded ${seeded} system PII records`);
    return { success: true, seeded: { piiRecords: seeded } };
  }

  async seedDemo(): Promise<Record<string, unknown>> {
    // Delete previous demo data first
    await this.piiRecordRepo.delete({ organizationHashId: 'O-DEMO1' });

    const records: Partial<PiiRecord>[] = [
      {
        hashId: 'PII-DM01',
        dataType: PiiDataType.EMAIL,
        encryptedValue: 'DEMO_ENCRYPTED_arjun.sharma@demo.com',
        encryptionKeyId: 'KEY-DEMO',
        organizationHashId: 'O-DEMO1',
        createdBy: 'U-DM01',
        expiresAt: null,
      },
      {
        hashId: 'PII-DM02',
        dataType: PiiDataType.NAME,
        encryptedValue: 'DEMO_ENCRYPTED_Arjun_Sharma',
        encryptionKeyId: 'KEY-DEMO',
        organizationHashId: 'O-DEMO1',
        createdBy: 'U-DM01',
        expiresAt: null,
      },
      {
        hashId: 'PII-DM03',
        dataType: PiiDataType.PHONE,
        encryptedValue: 'DEMO_ENCRYPTED_+91-9812345678',
        encryptionKeyId: 'KEY-DEMO',
        organizationHashId: 'O-DEMO1',
        createdBy: 'U-DM01',
        expiresAt: null,
      },
      {
        hashId: 'PII-DM04',
        dataType: PiiDataType.ADDRESS,
        encryptedValue: 'DEMO_ENCRYPTED_123_Main_Street_Mumbai_400001',
        encryptionKeyId: 'KEY-DEMO',
        organizationHashId: 'O-DEMO1',
        createdBy: 'U-DM01',
        expiresAt: null,
      },
      {
        hashId: 'PII-DM05',
        dataType: PiiDataType.DATE_OF_BIRTH,
        encryptedValue: 'DEMO_ENCRYPTED_1985-06-15',
        encryptionKeyId: 'KEY-DEMO',
        organizationHashId: 'O-DEMO1',
        createdBy: 'U-DM01',
        expiresAt: null,
      },
      {
        hashId: 'PII-DM06',
        dataType: PiiDataType.PASSPORT,
        encryptedValue: 'DEMO_ENCRYPTED_IN1234567',
        encryptionKeyId: 'KEY-DEMO',
        organizationHashId: 'O-DEMO1',
        createdBy: 'U-DM01',
        expiresAt: null,
      },
      {
        hashId: 'PII-DM07',
        dataType: PiiDataType.SSN,
        encryptedValue: 'DEMO_ENCRYPTED_123-45-6789',
        encryptionKeyId: 'KEY-DEMO',
        organizationHashId: 'O-DEMO1',
        createdBy: 'U-DM01',
        expiresAt: null,
      },
      {
        hashId: 'PII-DM08',
        dataType: PiiDataType.MEDICAL_RECORD,
        encryptedValue: 'DEMO_ENCRYPTED_MRN-2026-DEMO001',
        encryptionKeyId: 'KEY-DEMO',
        organizationHashId: 'O-DEMO1',
        createdBy: 'U-DM01',
        expiresAt: null,
      },
    ];

    const entities = this.piiRecordRepo.create(records);
    await this.piiRecordRepo.save(entities);
    this.logger.log(`Seeded ${entities.length} demo PII records`);

    return { success: true, seeded: { piiRecords: entities.length } };
  }

  async flushDemo(): Promise<Record<string, unknown>> {
    const result = await this.piiRecordRepo.delete({ organizationHashId: 'O-DEMO1' });
    const count = result.affected ?? 0;
    this.logger.log(`Flushed ${count} demo PII records`);
    return { success: true, flushed: { piiRecords: count } };
  }

  async flushAll(): Promise<Record<string, unknown>> {
    const count = await this.piiRecordRepo.count();
    await this.piiAccessLogRepo.clear();
    await this.piiRecordRepo.clear();
    this.logger.log(`Flushed all ${count} PII records and all access logs`);
    return { success: true, flushed: { piiRecords: count } };
  }
}
