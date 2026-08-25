import {
  IsEnum,
  IsIP,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

import {
  AssetStatus,
  AssetType,
  Severity,
} from '../../../generated/prisma/enums';

export class CreateAssetDto {
  @IsString()
  name: string;

  @IsEnum(AssetType)
  type: AssetType;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsIP()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  description?: string;

  /*
   * Set to opt this asset into the uptime checker, which polls
   * GET /assets and monitors whichever ones have this set.
   */
  @IsOptional()
  @IsUrl({ require_tld: false })
  monitoredUrl?: string;

  /*
   * Per-asset overrides for the uptime checker's defaults — a staging site
   * and a customer-facing API shouldn't necessarily page the same way.
   * Left unset, the checker falls back to its own env-wide default.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  checkThreshold?: number;

  @IsOptional()
  @IsEnum(Severity)
  checkSeverity?: Severity;
}
