import {
  IsEnum,
  IsIP,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  AssetStatus,
  AssetType,
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
}
