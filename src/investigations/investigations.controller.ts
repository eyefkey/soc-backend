import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import { InvestigationsService } from './investigations.service';
import { CreateInvestigationDto } from './dto/create-investigation.dto';

@Controller('investigations')
export class InvestigationsController {
  constructor(
    private readonly investigationsService: InvestigationsService,
  ) {}

  @Post()
  create(@Body() dto: CreateInvestigationDto) {
    return this.investigationsService.create(
      dto.incidentId,
    );
  }

  @Get()
  findAll() {
    return this.investigationsService.findAll();
  }

  @Get(':id/timeline')
  getTimeline(@Param('id') id: string) {
    return this.investigationsService.getTimeline(id);
  }

  @Get(':id/risk')
  getRisk(@Param('id') id: string) {
    return this.investigationsService.getRisk(id);
  }

  @Get(':id/correlations')
  getCorrelations(@Param('id') id: string) {
    return this.investigationsService.getCorrelations(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.investigationsService.findOne(id);
  }

  @Get(':id/summary')
  getSummary(@Param('id') id: string) {
    return this.investigationsService.getSummary(id);
  }
  @Get(':id/explanation')
  getExplanation(@Param('id') id: string) {
    return this.investigationsService.getExplanation(id);
  }
}
