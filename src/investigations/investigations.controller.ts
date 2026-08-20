import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { InvestigationsService } from './investigations.service';
import { InvestigationEventsService } from './investigation-events.service';
import { CreateInvestigationDto } from './dto/create-investigation.dto';
import { UpdateInvestigationDto } from './dto/update-investigation.dto';
import { QueryInvestigationsDto } from './dto/query-investigations.dto';

import { UserRole } from '../../generated/prisma/enums';
import { MinRole } from '../auth/decorators/min-role.decorator';

@Controller('investigations')
export class InvestigationsController {
  constructor(
    private readonly investigationsService: InvestigationsService,
    private readonly investigationEventsService: InvestigationEventsService,
  ) {}

  @MinRole(UserRole.ANALYST)
  @Post()
  create(@Body() dto: CreateInvestigationDto) {
    return this.investigationsService.create(dto.incidentId);
  }

  @Get()
  findAll(@Query() query: QueryInvestigationsDto) {
    return this.investigationsService.findAll(query);
  }

  @Get(':id/timeline')
  getTimeline(@Param('id') id: string) {
    return this.investigationsService.getTimeline(id);
  }

  @Get(':id/events')
  getEvents(@Param('id') id: string) {
    return this.investigationEventsService.getEvents(id);
  }

  @Get(':id/risk')
  getRisk(@Param('id') id: string) {
    return this.investigationsService.getRisk(id);
  }

  @Get(':id/correlations')
  getCorrelations(@Param('id') id: string) {
    return this.investigationsService.getCorrelations(id);
  }

  @Get(':id/summary')
  getSummary(@Param('id') id: string) {
    return this.investigationsService.getSummary(id);
  }

  @Get(':id/explanation')
  getExplanation(@Param('id') id: string) {
    return this.investigationsService.getExplanation(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.investigationsService.findOne(id);
  }

  @MinRole(UserRole.ANALYST)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvestigationDto) {
    return this.investigationsService.update(id, dto);
  }
}
