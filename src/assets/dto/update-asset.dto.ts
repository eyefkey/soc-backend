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

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(AssetType)
  type?: AssetType;

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

  @IsOptional()
  @IsUrl({ require_tld: false })
  monitoredUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  checkThreshold?: number;

  @IsOptional()
  @IsEnum(Severity)
  checkSeverity?: Severity;
}
