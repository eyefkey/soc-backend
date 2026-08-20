import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditAction, AuditEntity } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateFindingDto } from './dto/create-finding.dto';
import { UpdateFindingDto } from './dto/update-finding.dto';

@Injectable()
export class FindingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(investigationId: string, dto: CreateFindingDto) {
    const investigation = await this.prisma.investigation.findUnique({
      where: {
        id: investigationId,
      },
    });

    if (!investigation) {
      throw new NotFoundException('Investigation not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const finding = await tx.finding.create({
        data: {
          investigationId,
          title: dto.title,
          description: dto.description,
          confidence: dto.confidence,
          impact: dto.impact,
          recommendation: dto.recommendation,
        },
      });

      await this.audit.create(
        {
          action: AuditAction.CREATED,
          entity: AuditEntity.FINDING,
          entityId: finding.id,
          description: `Finding recorded: ${finding.title}`,
          metadata: {
            confidence: finding.confidence,
            investigationId,
          },
        },
        tx,
      );

      return finding;
    });
  }

  async findAll() {
    return this.prisma.finding.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByInvestigation(investigationId: string) {
    return this.prisma.finding.findMany({
      where: {
        investigationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const finding = await this.prisma.finding.findUnique({
      where: {
        id,
      },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    return finding;
  }

  async update(
    investigationId: string,
    findingId: string,
    dto: UpdateFindingDto,
  ) {
    const finding = await this.prisma.finding.findFirst({
      where: {
        id: findingId,
        investigationId,
      },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.finding.update({
        where: {
          id: findingId,
        },
        data: dto,
      });

      await this.audit.create(
        {
          action: AuditAction.UPDATED,
          entity: AuditEntity.FINDING,
          entityId: updated.id,
          description: `Finding updated: ${updated.title}`,
          metadata: {
            fields: Object.keys(dto),
            investigationId,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async remove(investigationId: string, findingId: string) {
    const finding = await this.prisma.finding.findFirst({
      where: {
        id: findingId,
        investigationId,
      },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const removed = await tx.finding.delete({
        where: {
          id: findingId,
        },
      });

      await this.audit.create(
        {
          action: AuditAction.DELETED,
          entity: AuditEntity.FINDING,
          entityId: removed.id,
          description: `Finding deleted: ${removed.title}`,
          metadata: {
            investigationId,
          },
        },
        tx,
      );

      return removed;
    });
  }
}
