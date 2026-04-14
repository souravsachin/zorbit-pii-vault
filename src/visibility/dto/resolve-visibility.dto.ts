import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResolveVisibilityContextDto {
  @ApiPropertyOptional({
    description: 'Hash ID of the user who owns the data. Used to determine self vs other context.',
    example: 'U-5678',
  })
  @IsOptional()
  @IsString()
  dataOwnerId?: string;
}

export class ResolveVisibilityDto {
  @ApiProperty({
    description: 'List of PII tokens to resolve',
    example: ['PII-A1B2', 'PII-C3D4', 'PII-E5F6'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tokens!: string[];

  @ApiProperty({
    description: 'Role of the caller (drives policy lookup)',
    example: 'broker',
  })
  @IsString()
  @IsNotEmpty()
  userRole!: string;

  @ApiProperty({
    description: 'Hash ID of the requesting user',
    example: 'U-1234',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiPropertyOptional({
    description: 'IP address of the caller (for IP-restricted policies). Auto-detected from request if omitted.',
    example: '192.168.1.100',
  })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'Additional context for policy resolution',
    type: ResolveVisibilityContextDto,
  })
  @IsOptional()
  @IsObject()
  context?: ResolveVisibilityContextDto;
}

export interface ResolvedToken {
  value: string;
  level: string; // 'full' | 'nickname' | 'masked' | 'token'
}

export interface ResolveVisibilityResult {
  resolved: Record<string, ResolvedToken>;
}
