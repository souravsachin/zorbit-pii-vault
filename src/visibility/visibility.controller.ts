import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../middleware/jwt-auth.guard';
import { VisibilityService } from './visibility.service';
import {
  CreateVisibilityPolicyDto,
  UpdateVisibilityPolicyDto,
} from './dto/create-visibility-policy.dto';
import {
  ResolveVisibilityDto,
  ResolveVisibilityResult,
} from './dto/resolve-visibility.dto';
import { VisibilityPolicy } from './entities/visibility-policy.entity';

/**
 * Visibility engine controller.
 *
 * Routes:
 *   Policies: /api/v1/O/:orgId/pii/visibility-policies
 *   Resolve:  POST /api/v1/O/:orgId/pii/resolve-visibility
 *   Seed:     POST /api/v1/O/:orgId/pii/visibility-policies/seed-defaults
 */
@ApiTags('visibility')
@ApiBearerAuth()
@Controller('api/v1/O/:orgId/pii')
@UseGuards(JwtAuthGuard)
export class VisibilityController {
  constructor(private readonly visibilityService: VisibilityService) {}

  // ── Policy CRUD ──────────────────────────────────────────────────────────

  @Post('visibility-policies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create visibility policy',
    description: 'Define a role-based PII visibility rule for an organisation.',
  })
  @ApiParam({ name: 'orgId', description: 'Organisation hash ID', example: 'O-92AF' })
  @ApiResponse({ status: 201, description: 'Policy created.' })
  @ApiResponse({ status: 401, description: 'Unauthorised.' })
  async createPolicy(
    @Param('orgId') orgId: string,
    @Body() dto: CreateVisibilityPolicyDto,
  ): Promise<VisibilityPolicy> {
    return this.visibilityService.createPolicy(orgId, dto);
  }

  @Get('visibility-policies')
  @ApiOperation({
    summary: 'List visibility policies',
    description: 'List all visibility policies for an organisation, with optional filters.',
  })
  @ApiParam({ name: 'orgId', description: 'Organisation hash ID', example: 'O-92AF' })
  @ApiQuery({ name: 'piiType', required: false, description: 'Filter by PII type' })
  @ApiQuery({ name: 'role', required: false, description: 'Filter by role' })
  @ApiResponse({ status: 200, description: 'Policy list.' })
  async listPolicies(
    @Param('orgId') orgId: string,
    @Query('piiType') piiType?: string,
    @Query('role') role?: string,
  ): Promise<VisibilityPolicy[]> {
    return this.visibilityService.listPolicies(orgId, { piiType, role });
  }

  @Get('visibility-policies/:policyId')
  @ApiOperation({ summary: 'Get a visibility policy by ID' })
  @ApiParam({ name: 'orgId', description: 'Organisation hash ID', example: 'O-92AF' })
  @ApiParam({ name: 'policyId', description: 'Policy hash ID', example: 'VP-A1B2' })
  @ApiResponse({ status: 200, description: 'Policy found.' })
  @ApiResponse({ status: 404, description: 'Policy not found.' })
  async getPolicy(
    @Param('orgId') orgId: string,
    @Param('policyId') policyId: string,
  ): Promise<VisibilityPolicy> {
    return this.visibilityService.getPolicy(orgId, policyId);
  }

  @Put('visibility-policies/:policyId')
  @ApiOperation({ summary: 'Update a visibility policy' })
  @ApiParam({ name: 'orgId', description: 'Organisation hash ID', example: 'O-92AF' })
  @ApiParam({ name: 'policyId', description: 'Policy hash ID', example: 'VP-A1B2' })
  @ApiResponse({ status: 200, description: 'Policy updated.' })
  @ApiResponse({ status: 404, description: 'Policy not found.' })
  async updatePolicy(
    @Param('orgId') orgId: string,
    @Param('policyId') policyId: string,
    @Body() dto: UpdateVisibilityPolicyDto,
  ): Promise<VisibilityPolicy> {
    return this.visibilityService.updatePolicy(orgId, policyId, dto);
  }

  @Delete('visibility-policies/:policyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a visibility policy' })
  @ApiParam({ name: 'orgId', description: 'Organisation hash ID', example: 'O-92AF' })
  @ApiParam({ name: 'policyId', description: 'Policy hash ID', example: 'VP-A1B2' })
  @ApiResponse({ status: 204, description: 'Policy deleted.' })
  @ApiResponse({ status: 404, description: 'Policy not found.' })
  async deletePolicy(
    @Param('orgId') orgId: string,
    @Param('policyId') policyId: string,
  ): Promise<void> {
    return this.visibilityService.deletePolicy(orgId, policyId);
  }

  // ── Seed Defaults ────────────────────────────────────────────────────────

  @Post('visibility-policies/seed-defaults')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Seed default visibility policies',
    description:
      'Insert the built-in default policies (admin=full, customer-self=full, broker-name=full, etc.). Safe to call multiple times — skips existing entries.',
  })
  @ApiParam({ name: 'orgId', description: 'Organisation hash ID', example: 'O-92AF' })
  @ApiResponse({ status: 200, description: 'Default policies seeded.' })
  async seedDefaults(
    @Param('orgId') orgId: string,
  ): Promise<{ message: string }> {
    await this.visibilityService.seedDefaultPolicies(orgId);
    return { message: `Default visibility policies seeded for org ${orgId}` };
  }

  // ── Resolve Visibility ───────────────────────────────────────────────────

  @Post('resolve-visibility')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve token visibility in batch',
    description:
      'Given a list of PII tokens, a caller role, and context, return the appropriate representation ' +
      'for each token according to the active visibility policies. ' +
      'Levels: full (decrypted), nickname (stable placeholder), masked (****), token (raw PII-XXXX).',
  })
  @ApiParam({ name: 'orgId', description: 'Organisation hash ID', example: 'O-92AF' })
  @ApiResponse({
    status: 200,
    description: 'Resolved token map.',
    schema: {
      example: {
        resolved: {
          'PII-A1B2': { value: 'Ahmed Al Maktoum', level: 'full' },
          'PII-C3D4': { value: 'Customer B', level: 'nickname' },
          'PII-E5F6': { value: '****', level: 'masked' },
        },
      },
    },
  })
  async resolveVisibility(
    @Param('orgId') orgId: string,
    @Body() dto: ResolveVisibilityDto,
    @Req() req: Request,
  ): Promise<ResolveVisibilityResult> {
    const requestIp = req.ip ?? null;
    return this.visibilityService.resolveVisibility(orgId, dto, requestIp);
  }
}
