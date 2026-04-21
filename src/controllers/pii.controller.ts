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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Request } from 'express';
import { TokenizationService } from '../services/tokenization.service';
import { DetokenizationService } from '../services/detokenization.service';
import { AuditService } from '../services/audit.service';
import { JwtAuthGuard } from '../middleware/jwt-auth.guard';
import { ZorbitPrivilegeGuard } from '../middleware/zorbit-privilege.guard';
import { RequirePrivileges } from '../middleware/decorators';
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
@ApiTags('pii')
@ApiBearerAuth()
@Controller('api/v1/G/pii')
@UseGuards(JwtAuthGuard, ZorbitPrivilegeGuard)
export class PiiController {
  constructor(
    private readonly tokenizationService: TokenizationService,
    private readonly detokenizationService: DetokenizationService,
    private readonly auditService: AuditService,
  ) {}

  @Post('tokenize')
  @RequirePrivileges('piivault.token.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tokenize PII', description: 'Store PII data encrypted, return an opaque token.' })
  @ApiResponse({ status: 201, description: 'PII tokenized successfully, token returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
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

  @Post('detokenize')
  @RequirePrivileges('piivault.token.read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Detokenize PII', description: 'Send a token, get the decrypted PII value back.' })
  @ApiResponse({ status: 200, description: 'PII detokenized successfully.' })
  @ApiResponse({ status: 404, description: 'Token not found.' })
  async detokenize(
    @Body() dto: DetokenizeDto,
    @Req() req: Request,
  ): Promise<DetokenizeResult> {
    const user = req.user as JwtPayload;
    const ipAddress = req.ip || null;

    return this.detokenizationService.detokenize(dto.token, user.sub, ipAddress);
  }

  @Post('bulk-tokenize')
  @RequirePrivileges('piivault.token.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bulk tokenize PII', description: 'Tokenize multiple PII values in one request.' })
  @ApiResponse({ status: 201, description: 'All PII values tokenized successfully.' })
  async bulkTokenize(
    @Body() dto: BulkTokenizeDto,
    @Req() req: Request,
  ): Promise<BulkTokenizeResult> {
    const user = req.user as JwtPayload;
    const ipAddress = req.ip || null;

    return this.tokenizationService.bulkTokenize(dto.items, user.sub, ipAddress);
  }

  @Post('bulk-detokenize')
  @RequirePrivileges('piivault.token.read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk detokenize PII', description: 'Detokenize multiple tokens in one request.' })
  @ApiResponse({ status: 200, description: 'All tokens detokenized successfully.' })
  async bulkDetokenize(
    @Body() dto: BulkDetokenizeDto,
    @Req() req: Request,
  ): Promise<BulkDetokenizeResult> {
    const user = req.user as JwtPayload;
    const ipAddress = req.ip || null;

    return this.detokenizationService.bulkDetokenize(dto.tokens, user.sub, ipAddress);
  }

  @Delete('tokens/:tokenId')
  @RequirePrivileges('piivault.token.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete PII token', description: 'Delete a PII token and its encrypted data.' })
  @ApiParam({ name: 'tokenId', description: 'PII token ID', example: 'PII-92AF' })
  @ApiResponse({ status: 204, description: 'Token deleted successfully.' })
  @ApiResponse({ status: 404, description: 'Token not found.' })
  async deleteToken(
    @Param('tokenId') tokenId: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as JwtPayload;
    const ipAddress = req.ip || null;

    return this.tokenizationService.deleteToken(tokenId, user.sub, ipAddress);
  }

  @Get('tokens/:tokenId/audit')
  @RequirePrivileges('piivault.token.read')
  @ApiOperation({ summary: 'Get PII access audit log', description: 'Get the access log for a specific PII token.' })
  @ApiParam({ name: 'tokenId', description: 'PII token ID', example: 'PII-92AF' })
  @ApiResponse({ status: 200, description: 'Access log returned.' })
  @ApiResponse({ status: 404, description: 'Token not found.' })
  async getAuditLog(
    @Param('tokenId') tokenId: string,
  ): Promise<PiiAccessLog[]> {
    return this.auditService.getAccessLogs(tokenId);
  }
}
