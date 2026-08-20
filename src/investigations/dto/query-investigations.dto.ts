import { IsEnum, IsOptional, IsString } from 'class-validator';
import { InvestigationStatus } from '../../../generated/prisma/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryInvestigationsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(InvestigationStatus)
  status?: InvestigationStatus;

  @IsOptional()
  @IsString()
  assignedTo?: string;
}
