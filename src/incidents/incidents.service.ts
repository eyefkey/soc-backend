import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntity } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { paginated } from '../common/interfaces/paginated.interface';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { QueryIncidentsDto } from './dto/query-incidents.dto';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateIncidentDto) {
    return this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: {
          title: dto.title,
          description: dto.description,
          severity: dto.severity,
          tactic: dto.tactic,
        },
      });

      await this.audit.create(
        {
          action: AuditAction.CREATED,
          entity: AuditEntity.INCIDENT,
          entityId: incident.id,
          description: `Incident created: ${incident.title}`,
          metadata: {
            severity: incident.severity,
            status: incident.status,
          },
        },
        tx,
      );

      return incident;
    });
  }

  async findAll(query: QueryIncidentsDto) {
    const { skip = 0, take = 25, status, severity, tactic } = query;

    const where = {
      ...(status ? { status } : {}),
      ...(severity ? { severity } : {}),
      ...(tactic ? { tactic } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        skip,
        take,
        orderBy: {
          createdAt: 'desc',
        },
        /*
         * The queue row shows the affected host, so the link is loaded
         * with the list rather than fetched per row by the client.
         */
        include: {
          assets: {
            include: {
              asset: true,
            },
          },
          investigation: {
            select: {
              id: true,
              status: true,
              assignedTo: true,
            },
          },
        },
      }),
      this.prisma.incident.count({ where }),
    ]);

    return paginated(data, total, skip, take);
  }

  async findOne(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: {
        id,
      },
      include: {
        alerts: true,
        evidence: true,
        assets: {
          include: {
            asset: true,
          },
        },
        investigation: true,
      },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    return incident;
  }

  async update(id: string, dto: UpdateIncidentDto) {
    const existing = await this.prisma.incident.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Incident not found');
    }

    const statusChanged =
      dto.status !== undefined && dto.status !== existing.status;

    return this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.update({
        where: {
          id,
        },
        data: dto,
      });

      /*
       * A status transition is the event responders care about, so it is
       * recorded distinctly from an ordinary field edit.
       */
      await this.audit.create(
        statusChanged
          ? {
              action: AuditAction.STATUS_CHANGED,
              entity: AuditEntity.INCIDENT,
              entityId: incident.id,
              description: `Incident status changed: ${existing.status} to ${incident.status}`,
              metadata: {
                from: existing.status,
                to: incident.status,
              },
            }
          : {
              action: AuditAction.UPDATED,
              entity: AuditEntity.INCIDENT,
              entityId: incident.id,
              description: `Incident updated: ${incident.title}`,
              metadata: {
                fields: Object.keys(dto),
              },
            },
        tx,
      );

      return incident;
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.incident.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Incident not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.delete({
        where: {
          id,
        },
      });

      /*
       * Audit rows carry no foreign key, so the trail for a deleted
       * incident survives the incident itself.
       */
      await this.audit.create(
        {
          action: AuditAction.DELETED,
          entity: AuditEntity.INCIDENT,
          entityId: incident.id,
          description: `Incident deleted: ${incident.title}`,
        },
        tx,
      );

      return incident;
    });
  }
}
