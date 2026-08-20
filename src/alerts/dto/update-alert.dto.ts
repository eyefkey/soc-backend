import {
  IsEnum,
  IsIP,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { Severity } from '../../../generated/prisma/enums';

export class UpdateAlertDto {
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
  @IsString()
  source?: string;

  @IsOptional()
  @IsIP()
  sourceIp?: string;

  @IsOptional()
  @IsIP()
  targetIp?: string;

  /*
   * Explicit null detaches the alert from its incident; omitting the field
   * leaves the current link untouched.
   */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  incidentId?: string | null;
}
