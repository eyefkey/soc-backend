import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  IncidentStatus,
  MitreTactic,
  Severity,
} from '../../../generated/prisma/enums';

export class UpdateIncidentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(MitreTactic)
  tactic?: MitreTactic;
}
