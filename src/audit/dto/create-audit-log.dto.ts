import { IsEnum, IsIP, IsOptional, IsString } from 'class-validator';

import { AuditAction, AuditEntity } from '../../../generated/prisma/enums';

export class CreateAuditLogDto {
  @IsEnum(AuditAction)
  action: AuditAction;

  @IsEnum(AuditEntity)
  entity: AuditEntity;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIP()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
