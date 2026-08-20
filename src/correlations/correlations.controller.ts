import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';

import { CorrelationsService } from './correlations.service';

@Controller('correlations')
export class CorrelationsController {
  constructor(
    private readonly correlationsService: CorrelationsService,
  ) {}

  @Get('investigation/:id')
  getInvestigationCorrelations(
    @Param('id') id: string,
  ) {
    return this.correlationsService.getInvestigationCorrelations(
      id,
    );
  }
}
