import {
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  FindingConfidence,
} from '../../../generated/prisma/enums';

export class CreateFindingDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(FindingConfidence)
  @IsOptional()
  confidence?: FindingConfidence;

  @IsString()
  @IsOptional()
  impact?: string;

  @IsString()
  @IsOptional()
  recommendation?: string;
}