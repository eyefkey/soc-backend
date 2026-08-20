import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EvidenceType } from '../../../generated/prisma/enums';

export class CreateEvidenceDto {
  @IsEnum(EvidenceType)
  type: EvidenceType;

  @IsString()
  value: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  incidentId: string;
}
