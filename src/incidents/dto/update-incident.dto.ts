import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IncidentStatus, Severity } from '../../../generated/prisma/enums';

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
}
