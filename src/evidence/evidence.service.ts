import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditAction, AuditEntity } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { paginated } from '../common/interfaces/paginated.interface';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { UpdateEvidenceDto } from './dto/update-evidence.dto';
import { QueryEvidenceDto } from './dto/query-evidence.dto';

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateEvidenceDto) {
    const incident = await this.prisma.incident.findUnique({
      where: {
        id: dto.incidentId,
      },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const evidence = await tx.evidence.create({
        data: {
          type: dto.type,
          value: dto.value,
          description: dto.description,
          incidentId: dto.incidentId,
        },
      });

      await this.audit.create(
        {
          action: AuditAction.CREATED,
          entity: AuditEntity.EVIDENCE,
          entityId: evidence.id,
          description: `Evidence collected: ${
            evidence.description ?? evidence.value
          }`,
          metadata: {
            evidenceType: evidence.type,
            value: evidence.value,
            incidentId: evidence.incidentId,
          },
        },
        tx,
      );

      return evidence;
    });
  }

  async findAll(query: QueryEvidenceDto) {
    const { skip = 0, take = 25, type, incidentId } = query;

    const where = {
      ...(type ? { type } : {}),
      ...(incidentId ? { incidentId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.evidence.findMany({
        where,
        skip,
        take,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          incident: true,
        },
      }),
      this.prisma.evidence.count({ where }),
    ]);

    return paginated(data, total, skip, take);
  }

  async findOne(id: string) {
    const evidence = await this.prisma.evidence.findUnique({
      where: {
        id,
      },
      include: {
        incident: true,
      },
    });

    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    return evidence;
  }

  async update(id: string, dto: UpdateEvidenceDto) {
    const existing = await this.prisma.evidence.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Evidence not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const evidence = await tx.evidence.update({
        where: {
          id,
        },
        data: dto,
      });

      await this.audit.create(
        {
          action: AuditAction.UPDATED,
          entity: AuditEntity.EVIDENCE,
          entityId: evidence.id,
          description: `Evidence updated: ${
            evidence.description ?? evidence.value
          }`,
          metadata: {
            fields: Object.keys(dto),
          },
        },
        tx,
      );

      return evidence;
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.evidence.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Evidence not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const evidence = await tx.evidence.delete({
        where: {
          id,
        },
      });

      await this.audit.create(
        {
          action: AuditAction.DELETED,
          entity: AuditEntity.EVIDENCE,
          entityId: evidence.id,
          description: `Evidence deleted: ${
            evidence.description ?? evidence.value
          }`,
        },
        tx,
      );

      return evidence;
    });
  }
}
