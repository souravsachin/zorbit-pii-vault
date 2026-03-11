import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { TokenizationService } from '../services/tokenization.service';
import { DetokenizationService } from '../services/detokenization.service';
import { AuditService } from '../services/audit.service';
import { JwtAuthGuard } from '../middleware/jwt-auth.guard';
import { JwtPayload } from '../middleware/jwt.strategy';
import {
  TokenizeDto,
  DetokenizeDto,
  BulkTokenizeDto,
  BulkDetokenizeDto,
  TokenizeResult,
  DetokenizeResult,
  BulkTokenizeResult,
  BulkDetokenizeResult,
} from '../models/dto/tokenize.dto';
import { PiiAccessLog } from '../models/entities/pii-access-log.entity';

/**
 * PII Vault controller.
 * All endpoints require JWT authentication.
 * PII data is encrypted at rest — raw PII is never stored.
 */
@Controller('api/v1/G/pii')
@UseGuards(JwtAuthGuard)
export class PiiController {
  constructor(
    private readonly tokenizationService: TokenizationService,
    private readonly detokenizationService: DetokenizationService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * POST /api/v1/G/pii/tokenize
   * Store PII data encrypted, return an opaque token.
   */
  @Post('tokenize')
  @HttpCode(HttpStatus.CREATED)
  async tokenize(
    @Body() dto: TokenizeDto,
    @Req() req: Request,
  ): Promise<TokenizeResult> {
    const user = req.user as JwtPayload;
    const ipAddress = req.ip || null;

    return this.tokenizationService.tokenize(
      dto.value,
      dto.dataType,
      dto.organizationHashId,
      user.sub,
      ipAddress,
      dto.expiresAt ? new Date(dto.expiresAt) : null,
    );
  }

  /**
   * POST /api/v1/G/pii/detokenize
   * Send a token, get the decrypted PII value back.
   */
  @Post('detokenize')
  @HttpCode(HttpStatus.OK)
  async detokenize(
    @Body() dto: DetokenizeDto,
    @Req() req: Request,
  ): Promise<DetokenizeResult> {
    const user = req.user as JwtPayload;
    const ipAddress = req.ip || null;

    return this.detokenizationService.detokenize(dto.token, user.sub, ipAddress);
  }

  /**
   * POST /api/v1/G/pii/bulk-tokenize
   * Tokenize multiple PII values in one request.
   */
  @Post('bulk-tokenize')
  @HttpCode(HttpStatus.CREATED)
  async bulkTokenize(
    @Body() dto: BulkTokenizeDto,
    @Req() req: Request,
  ): Promise<BulkTokenizeResult> {
    const user = req.user as JwtPayload;
    const ipAddress = req.ip || null;

    return this.tokenizationService.bulkTokenize(dto.items, user.sub, ipAddress);
  }

  /**
   * POST /api/v1/G/pii/bulk-detokenize
   * Detokenize multiple tokens in one request.
   */
  @Post('bulk-detokenize')
  @HttpCode(HttpStatus.OK)
  async bulkDetokenize(
    @Body() dto: BulkDetokenizeDto,
    @Req() req: Request,
  ): Promise<BulkDetokenizeResult> {
    const user = req.user as JwtPayload;
    const ipAddress = req.ip || null;

    return this.detokenizationService.bulkDetokenize(dto.tokens, user.sub, ipAddress);
  }

  /**
   * DELETE /api/v1/G/pii/tokens/:tokenId
   * Delete a PII token and its encrypted data.
   */
  @Delete('tokens/:tokenId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteToken(
    @Param('tokenId') tokenId: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as JwtPayload;
    const ipAddress = req.ip || null;

    return this.tokenizationService.deleteToken(tokenId, user.sub, ipAddress);
  }

  /**
   * GET /api/v1/G/pii/tokens/:tokenId/audit
   * Get the access log for a specific PII token.
   */
  @Get('tokens/:tokenId/audit')
  async getAuditLog(
    @Param('tokenId') tokenId: string,
  ): Promise<PiiAccessLog[]> {
    return this.auditService.getAccessLogs(tokenId);
  }
}
