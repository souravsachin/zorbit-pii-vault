import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { PiiDataType } from '../entities/pii-record.entity';

export class TokenizeDto {
  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsEnum(PiiDataType)
  dataType!: PiiDataType;

  @IsString()
  @IsNotEmpty()
  organizationHashId!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class DetokenizeDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class BulkTokenizeDto {
  items!: TokenizeDto[];
}

export class BulkDetokenizeDto {
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
