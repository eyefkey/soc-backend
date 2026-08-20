import { IsEnum, IsOptional } from 'class-validator';
import {
  IncidentStatus,
  MitreTactic,
  Severity,
} from '../../../generated/prisma/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryIncidentsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @IsOptional()
  @IsEnum(MitreTactic)
  tactic?: MitreTactic;
}
