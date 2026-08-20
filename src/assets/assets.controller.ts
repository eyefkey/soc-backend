import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { QueryAssetsDto } from './dto/query-assets.dto';

import { UserRole } from '../../generated/prisma/enums';
import { MinRole } from '../auth/decorators/min-role.decorator';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @MinRole(UserRole.ANALYST)
  @Post()
  create(@Body() dto: CreateAssetDto) {
    return this.assetsService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryAssetsDto) {
    return this.assetsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(id);
  }

  @MinRole(UserRole.ANALYST)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.assetsService.update(id, dto);
  }

  @MinRole(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.assetsService.remove(id);
  }

  @MinRole(UserRole.ANALYST)
  @Post(':id/incidents/:incidentId')
  attachToIncident(
    @Param('id') id: string,
    @Param('incidentId') incidentId: string,
  ) {
    return this.assetsService.attachToIncident(id, incidentId);
  }

  /*
   * Detaching mirrors attaching: both are triage, so both sit at ANALYST.
   * Deleting the asset record itself remains ADMIN.
   */
  @MinRole(UserRole.ANALYST)
  @Delete(':id/incidents/:incidentId')
  detachFromIncident(
    @Param('id') id: string,
    @Param('incidentId') incidentId: string,
  ) {
    return this.assetsService.detachFromIncident(id, incidentId);
  }
}
