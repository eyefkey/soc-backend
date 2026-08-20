import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EvidenceType } from '../../../generated/prisma/enums';

export class UpdateEvidenceDto {
  @IsOptional()
  @IsEnum(EvidenceType)
  type?: EvidenceType;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
