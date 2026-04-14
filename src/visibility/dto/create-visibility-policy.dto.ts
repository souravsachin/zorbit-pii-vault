import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVisibilityPolicyDto {
  @ApiProperty({
    description: 'PII data type this policy applies to. Use * for wildcard.',
    example: 'email',
  })
  @IsString()
  @IsNotEmpty()
  piiType!: string;

  @ApiProperty({
    description: 'Role this policy applies to. Use * for wildcard.',
    example: 'broker',
  })
  @IsString()
  @IsNotEmpty()
  role!: string;

  @ApiProperty({
    description: 'Context type: self (viewing own data), other (viewing someone else data), any (always applies)',
    enum: ['self', 'other', 'any'],
    example: 'other',
  })
  @IsIn(['self', 'other', 'any'])
  contextType!: string;

  @ApiProperty({
    description: 'Visibility level to apply: full, nickname, masked, or token',
    enum: ['full', 'nickname', 'masked', 'token'],
    example: 'masked',
  })
  @IsIn(['full', 'nickname', 'masked', 'token'])
  visibilityLevel!: string;

  @ApiPropertyOptional({
    description: 'Optional IP restriction (CIDR or exact IP). Null = no restriction.',
    example: '192.168.1.0/24',
  })
  @IsOptional()
  @IsString()
  ipRestriction?: string;

  @ApiPropertyOptional({
    description: 'Whether the policy is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVisibilityPolicyDto {
  @ApiPropertyOptional({ description: 'PII data type', example: 'email' })
  @IsOptional()
  @IsString()
  piiType?: string;

  @ApiPropertyOptional({ description: 'Role', example: 'broker' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    description: 'Context type',
    enum: ['self', 'other', 'any'],
  })
  @IsOptional()
  @IsIn(['self', 'other', 'any'])
  contextType?: string;

  @ApiPropertyOptional({
    description: 'Visibility level',
    enum: ['full', 'nickname', 'masked', 'token'],
  })
  @IsOptional()
  @IsIn(['full', 'nickname', 'masked', 'token'])
  visibilityLevel?: string;

  @ApiPropertyOptional({ description: 'IP restriction (CIDR or exact IP)' })
  @IsOptional()
  @IsString()
  ipRestriction?: string;

  @ApiPropertyOptional({ description: 'Whether the policy is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
