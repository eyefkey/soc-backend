import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAuditLogDto) {
  return this.prisma.auditLog.create({
    data: {
      action: dto.action,
      entity: dto.entity,
      entityId: dto.entityId,
      userId: dto.userId,
      username: dto.username,
      description: dto.description,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
      metadata: dto.metadata
        ? (dto.metadata as Prisma.InputJsonValue)
        : undefined,
    },
  });
}

  async findAll() {
    return this.prisma.auditLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByEntity(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        entity: entity as any,
        entityId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}
