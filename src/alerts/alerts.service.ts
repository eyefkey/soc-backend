import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, AuditEntity } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { paginated } from '../common/interfaces/paginated.interface';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { QueryAlertsDto } from './dto/query-alerts.dto';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async assertIncidentExists(incidentId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: {
        id: incidentId,
      },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
  }

  async create(dto: CreateAlertDto) {
    if (dto.incidentId) {
      await this.assertIncidentExists(dto.incidentId);
    }

    return this.prisma.$transaction(async (tx) => {
      const alert = await tx.alert.create({
        data: {
          title: dto.title,
          description: dto.description,
          severity: dto.severity,
          source: dto.source,
          sourceIp: dto.sourceIp,
          targetIp: dto.targetIp,
          tactic: dto.tactic,
          affectedUser: dto.affectedUser,
          incidentId: dto.incidentId,
        },
      });

      await this.audit.create(
        {
          action: AuditAction.CREATED,
          entity: AuditEntity.ALERT,
          entityId: alert.id,
          description: `Alert raised: ${alert.title}`,
          metadata: {
            severity: alert.severity,
            source: alert.source,
            sourceIp: alert.sourceIp,
            targetIp: alert.targetIp,
            incidentId: alert.incidentId,
          },
        },
        tx,
      );

      return alert;
    });
  }

  async findAll(query: QueryAlertsDto) {
    const { skip = 0, take = 25, severity, incidentId, source, tactic } = query;

    const where = {
      ...(severity ? { severity } : {}),
      ...(incidentId ? { incidentId } : {}),
      ...(source ? { source } : {}),
      ...(tactic ? { tactic } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.alert.findMany({
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
      this.prisma.alert.count({ where }),
    ]);

    return paginated(data, total, skip, take);
  }

  async findOne(id: string) {
    const alert = await this.prisma.alert.findUnique({
      where: {
        id,
      },
      include: {
        incident: true,
      },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return alert;
  }

  async update(id: string, dto: UpdateAlertDto) {
    const existing = await this.prisma.alert.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Alert not found');
    }

    if (dto.incidentId) {
      await this.assertIncidentExists(dto.incidentId);
    }

    const linkChanged =
      dto.incidentId !== undefined && dto.incidentId !== existing.incidentId;

    return this.prisma.$transaction(async (tx) => {
      const alert = await tx.alert.update({
        where: {
          id,
        },
        data: dto,
      });

      await this.audit.create(
        {
          action: AuditAction.UPDATED,
          entity: AuditEntity.ALERT,
          entityId: alert.id,
          description: `Alert updated: ${alert.title}`,
          metadata: {
            fields: Object.keys(dto),
          },
        },
        tx,
      );

      /*
       * Triage moves alerts between incidents; each side of that move is
       * recorded against the incident so it lands on the timeline.
       */
      if (linkChanged) {
        if (existing.incidentId) {
          await this.audit.create(
            {
              action: AuditAction.DETACHED,
              entity: AuditEntity.INCIDENT,
              entityId: existing.incidentId,
              description: `Alert detached: ${alert.title}`,
              metadata: {
                alertId: alert.id,
              },
            },
            tx,
          );
        }

        if (alert.incidentId) {
          await this.audit.create(
            {
              action: AuditAction.ATTACHED,
              entity: AuditEntity.INCIDENT,
              entityId: alert.incidentId,
              description: `Alert attached: ${alert.title}`,
              metadata: {
                alertId: alert.id,
              },
            },
            tx,
          );
        }
      }

      return alert;
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.alert.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Alert not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const alert = await tx.alert.delete({
        where: {
          id,
        },
      });

      await this.audit.create(
        {
          action: AuditAction.DELETED,
          entity: AuditEntity.ALERT,
          entityId: alert.id,
          description: `Alert deleted: ${alert.title}`,
        },
        tx,
      );

      return alert;
    });
  }
}
