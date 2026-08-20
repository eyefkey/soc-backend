import { IsString } from 'class-validator';

export class CreateInvestigationDto {
  @IsString()
  incidentId: string;
}
