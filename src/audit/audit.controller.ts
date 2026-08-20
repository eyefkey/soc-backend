import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Query,
} from '@nestjs/common';

import { AuditEntity } from '../../generated/prisma/enums';

import { AuditService } from './audit.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { QueryAuditDto } from './dto/query-audit.dto';

import { UserRole } from '../../generated/prisma/enums';
import { MinRole } from '../auth/decorators/min-role.decorator';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @MinRole(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateAuditLogDto) {
    return this.auditService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryAuditDto) {
    return this.auditService.findAll(query);
  }

  @Get('entity/:entity/:entityId')
  findByEntity(
    @Param('entity', new ParseEnumPipe(AuditEntity))
    entity: AuditEntity,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.findByEntity(entity, entityId);
  }
}
