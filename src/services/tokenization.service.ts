import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PiiRecord, PiiDataType } from '../models/entities/pii-record.entity';
import { PiiAccessAction } from '../models/entities/pii-access-log.entity';
import { EncryptionService } from './encryption.service';
import { AuditService } from './audit.service';
import { HashIdService } from './hash-id.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { PiiEvents } from '../events/pii.events';
import {
  TokenizeResult,
  BulkTokenizeResult,
} from '../models/dto/tokenize.dto';

/**
 * Handles PII tokenization: encrypts PII data with AES-256-GCM, stores it,
 * and returns an opaque token (PII-XXXX).
 */
@Injectable()
export class TokenizationService {
  private readonly logger = new Logger(TokenizationService.name);

  constructor(
    @InjectRepository(PiiRecord)
    private readonly piiRepository: Repository<PiiRecord>,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
    private readonly hashIdService: HashIdService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  /**
   * Tokenize a single PII value: encrypt and store, return opaque token.
   */
  async tokenize(
    value: string,
    dataType: PiiDataType,
    organizationHashId: string,
    createdBy: string,
    ipAddress: string | null,
    expiresAt?: Date | null,
  ): Promise<TokenizeResult> {
    const activeKey = await this.encryptionService.getActiveKey();
    if (!activeKey) {
      throw new Error('No active encryption key available');
    }

    const encryptedValue = this.encryptionService.encrypt(value, activeKey);
    const hashId = this.hashIdService.generate('PII');

    const record = this.piiRepository.create({
      hashId,
      dataType,
      encryptedValue,
      encryptionKeyId: activeKey.hashId,
      organizationHashId,
      createdBy,
      expiresAt: expiresAt || null,
    });

    await this.piiRepository.save(record);

    // Log the access
    await this.auditService.logAccess(hashId, createdBy, PiiAccessAction.TOKENIZE, ipAddress);

    // Publish event
    await this.eventPublisher.publish(PiiEvents.TOKEN_CREATED, 'G', 'G', {
      tokenHashId: hashId,
      dataType,
      organizationHashId,
      createdBy,
    });

    this.logger.debug(`Tokenized PII ${dataType} → ${hashId}`);

    return {
      token: hashId,
      dataType,
      createdAt: record.createdAt,
    };
  }

  /**
   * Bulk tokenize multiple PII values.
   */
  async bulkTokenize(
    items: Array<{
      value: string;
      dataType: PiiDataType;
      organizationHashId: string;
      expiresAt?: string;
    }>,
    createdBy: string,
    ipAddress: string | null,
  ): Promise<BulkTokenizeResult> {
    const results: TokenizeResult[] = [];

    for (const item of items) {
      const result = await this.tokenize(
        item.value,
        item.dataType,
        item.organizationHashId,
        createdBy,
        ipAddress,
        item.expiresAt ? new Date(item.expiresAt) : null,
      );
      results.push(result);
    }

    return { results };
  }

  /**
   * Delete a PII token and its encrypted data.
   */
  async deleteToken(
    tokenId: string,
    deletedBy: string,
    ipAddress: string | null,
  ): Promise<void> {
    const record = await this.piiRepository.findOne({
      where: { hashId: tokenId },
    });

    if (!record) {
      throw new NotFoundException(`PII token ${tokenId} not found`);
    }

    await this.piiRepository.remove(record);

    // Log the access
    await this.auditService.logAccess(tokenId, deletedBy, PiiAccessAction.DELETE, ipAddress);

    // Publish event
    await this.eventPublisher.publish(PiiEvents.TOKEN_DELETED, 'G', 'G', {
      tokenHashId: tokenId,
      deletedBy,
    });

    this.logger.log(`Deleted PII token ${tokenId}`);
  }

  /**
   * Delete all PII records created by a specific user (cascade on user deletion).
   */
  async deleteAllByCreator(creatorHashId: string): Promise<void> {
    const records = await this.piiRepository.find({
      where: { createdBy: creatorHashId },
    });

    if (records.length === 0) {
      return;
    }

    await this.piiRepository.remove(records);

    for (const record of records) {
      await this.eventPublisher.publish(PiiEvents.TOKEN_DELETED, 'G', 'G', {
        tokenHashId: record.hashId,
        deletedBy: 'system:cascade',
      });
    }

    this.logger.log(
      `Cascade deleted ${records.length} PII tokens for user ${creatorHashId}`,
    );
  }

  /**
   * Get a PII record by token hash ID (for detokenization).
   */
  async getByToken(tokenId: string): Promise<PiiRecord> {
    const record = await this.piiRepository.findOne({
      where: { hashId: tokenId },
    });

    if (!record) {
      throw new NotFoundException(`PII token ${tokenId} not found`);
    }

    // Check expiration
    if (record.expiresAt && record.expiresAt < new Date()) {
      throw new NotFoundException(`PII token ${tokenId} has expired`);
    }

    return record;
  }
}
