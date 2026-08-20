import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
} from '@nestjs/common';

import { FindingsService } from './findings.service';
import { CreateFindingDto } from './dto/create-finding.dto';
import { UpdateFindingDto } from './dto/update-finding.dto';

@Controller('investigations/:investigationId/findings')
export class FindingsController {
  constructor(
    private readonly findingsService: FindingsService,
  ) {}

  @Post()
  create(
    @Param('investigationId') investigationId: string,
    @Body() dto: CreateFindingDto,
  ) {
    return this.findingsService.create(
      investigationId,
      dto,
    );
  }

  @Get()
  findByInvestigation(
    @Param('investigationId')
    investigationId: string,
  ) {
    return this.findingsService.findByInvestigation(
      investigationId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.findingsService.findOne(id);
  }

  @Patch(':id')
  update(
  @Param('investigationId') investigationId: string,
  @Param('id') findingId: string,
  @Body() dto: UpdateFindingDto,
) {
  return this.findingsService.update(
    investigationId,
    findingId,
    dto,
  );
}

  @Delete(':id')
  remove(
  @Param('investigationId') investigationId: string,
  @Param('id') findingId: string,
) {
  return this.findingsService.remove(
    investigationId,
    findingId,
  );
}
}