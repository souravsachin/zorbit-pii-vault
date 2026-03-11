import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PiiDataType } from '../entities/pii-record.entity';

export class TokenizeDto {
  @ApiProperty({ description: 'Raw PII value to tokenize', example: 'user@example.com' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiProperty({ description: 'Type of PII data', enum: ['email', 'phone', 'ssn', 'address', 'name', 'custom'] })
  @IsEnum(PiiDataType)
  dataType!: PiiDataType;

  @ApiProperty({ description: 'Organization short hash ID', example: 'O-92AF' })
  @IsString()
  @IsNotEmpty()
  organizationHashId!: string;

  @ApiPropertyOptional({ description: 'Expiration date for the token (ISO 8601)', example: '2027-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class DetokenizeDto {
  @ApiProperty({ description: 'PII token to detokenize', example: 'PII-92AF' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class BulkTokenizeDto {
  @ApiProperty({ description: 'Array of PII items to tokenize', type: [TokenizeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TokenizeDto)
  items!: TokenizeDto[];
}

export class BulkDetokenizeDto {
  @ApiProperty({ description: 'Array of PII tokens to detokenize', example: ['PII-92AF', 'PII-81F3'] })
  @IsArray()
  @IsString({ each: true })
  tokens!: string[];
}

export interface TokenizeResult {
  token: string;
  dataType: PiiDataType;
  createdAt: Date;
}

export interface DetokenizeResult {
  token: string;
  value: string;
  dataType: PiiDataType;
}

export interface BulkTokenizeResult {
  results: TokenizeResult[];
}

export interface BulkDetokenizeResult {
  results: DetokenizeResult[];
}
