import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AssetStatus, AssetType } from '../../../generated/prisma/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryAssetsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AssetType)
  type?: AssetType;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}
