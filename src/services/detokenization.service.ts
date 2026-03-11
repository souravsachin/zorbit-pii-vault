import { Injectable, Logger } from '@nestjs/common';
import { PiiAccessAction } from '../models/entities/pii-access-log.entity';
import { EncryptionService } from './encryption.service';
import { AuditService } from './audit.service';
import { TokenizationService } from './tokenization.service';
import { EventPublisherService } from '../events/event-publisher.service';
import { PiiEvents } from '../events/pii.events';
import {
  DetokenizeResult,
  BulkDetokenizeResult,
} from '../models/dto/tokenize.dto';

/**
 * Handles PII detokenization: validates access, decrypts, returns original value, and logs access.
 */
@Injectable()
export class DetokenizationService {
  private readonly logger = new Logger(DetokenizationService.name);

  constructor(
    private readonly tokenizationService: TokenizationService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  /**
   * Detokenize a single PII token: look up, decrypt, log access, return value.
   */
  async detokenize(
    token: string,
    accessedBy: string,
    ipAddress: string | null,
  ): Promise<DetokenizeResult> {
    // Look up the PII record
    const record = await this.tokenizationService.getByToken(token);

    // Get the encryption key used for this record
    const encryptionKey = await this.encryptionService.getKeyByHashId(record.encryptionKeyId);
    if (!encryptionKey) {
      throw new Error(`Encryption key ${record.encryptionKeyId} not found`);
    }

    // Decrypt the PII value
    const value = this.encryptionService.decrypt(record.encryptedValue, encryptionKey);

    // Log the access
    await this.auditService.logAccess(
      token,
      accessedBy,
      PiiAccessAction.DETOKENIZE,
      ipAddress,
    );

    // Publish event
    await this.eventPublisher.publish(PiiEvents.TOKEN_ACCESSED, 'G', 'G', {
      tokenHashId: token,
      accessedBy,
      dataType: record.dataType,
    });

    this.logger.debug(`Detokenized PII ${token} for ${accessedBy}`);

    return {
      token,
      value,
      dataType: record.dataType,
    };
  }

  /**
   * Bulk detokenize multiple PII tokens.
   */
  async bulkDetokenize(
    tokens: string[],
    accessedBy: string,
    ipAddress: string | null,
  ): Promise<BulkDetokenizeResult> {
    const results: DetokenizeResult[] = [];

    for (const token of tokens) {
      const result = await this.detokenize(token, accessedBy, ipAddress);
      results.push(result);
    }

    return { results };
  }
}
