import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PiiAccessLog, PiiAccessAction } from '../models/entities/pii-access-log.entity';
import { HashIdService } from './hash-id.service';

/**
 * Logs all PII access operations to the PiiAccessLog table.
 * Every tokenize, detokenize, and delete operation is recorded.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(PiiAccessLog)
    private readonly accessLogRepository: Repository<PiiAccessLog>,
    private readonly hashIdService: HashIdService,
  ) {}

  /**
   * Record a PII access event.
   */
  async logAccess(
    piiTokenId: string,
    accessedBy: string,
    action: PiiAccessAction,
    ipAddress: string | null,
  ): Promise<PiiAccessLog> {
    const log = this.accessLogRepository.create({
      hashId: this.hashIdService.generate('PAL'),
      piiTokenId,
      accessedBy,
      action,
      ipAddress,
    });

    const saved = await this.accessLogRepository.save(log);
    this.logger.debug(
      `PII access logged: ${action} on ${piiTokenId} by ${accessedBy}`,
    );
    return saved;
  }

  /**
   * Get all access logs for a specific PII token.
   */
  async getAccessLogs(piiTokenId: string): Promise<PiiAccessLog[]> {
    return this.accessLogRepository.find({
      where: { piiTokenId },
      order: { createdAt: 'DESC' },
    });
  }
}
