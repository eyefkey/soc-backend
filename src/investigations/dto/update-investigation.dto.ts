import { IsEnum, IsOptional, IsString } from 'class-validator';
import { InvestigationStatus } from '../../../generated/prisma/enums';

export class UpdateInvestigationDto {
  @IsOptional()
  @IsEnum(InvestigationStatus)
  status?: InvestigationStatus;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  conclusion?: string;
}
