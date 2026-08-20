import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MitreTactic, Severity } from '../../../generated/prisma/enums';

export class CreateIncidentDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(Severity)
  severity: Severity;

  @IsOptional()
  @IsEnum(MitreTactic)
  tactic?: MitreTactic;
}
