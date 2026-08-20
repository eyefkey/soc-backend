import { IsEnum, IsIP, IsOptional, IsString } from 'class-validator';
import { MitreTactic, Severity } from '../../../generated/prisma/enums';

export class CreateAlertDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(Severity)
  severity: Severity;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsIP()
  sourceIp?: string;

  @IsOptional()
  @IsIP()
  targetIp?: string;

  @IsOptional()
  @IsEnum(MitreTactic)
  tactic?: MitreTactic;

  @IsOptional()
  @IsString()
  affectedUser?: string;

  @IsOptional()
  @IsString()
  incidentId?: string;
}
