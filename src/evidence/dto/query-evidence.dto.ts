import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EvidenceType } from '../../../generated/prisma/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryEvidenceDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(EvidenceType)
  type?: EvidenceType;

  @IsOptional()
  @IsString()
  incidentId?: string;
}
