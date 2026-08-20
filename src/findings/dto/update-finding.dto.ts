import { IsEnum, IsOptional, IsString } from 'class-validator';

import { FindingConfidence } from '../../../generated/prisma/enums';

export class UpdateFindingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(FindingConfidence)
  confidence?: FindingConfidence;

  @IsOptional()
  @IsString()
  impact?: string;

  @IsOptional()
  @IsString()
  recommendation?: string;
}
