import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditAction, AuditEntity } from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { paginated } from '../common/interfaces/paginated.interface';
import { UpdateInvestigationDto } from './dto/update-investigation.dto';
import { QueryInvestigationsDto } from './dto/query-investigations.dto';
import { CorrelationsService } from '../correlations/correlations.service';
import { InvestigationContextService } from '../correlations/investigation-context.service';
import { RiskScoreService } from '../correlations/risk-score.service';

@Injectable()
export class InvestigationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: InvestigationContextService,
    private readonly correlations: CorrelationsService,
    private readonly riskScore: RiskScoreService,
    private readonly audit: AuditService,
  ) {}

  async create(incidentId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: {
        id: incidentId,
      },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    const existing = await this.prisma.investigation.findUnique({
      where: {
        incidentId,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const investigation = await tx.investigation.create({
        data: {
          incidentId,
        },
      });

      await this.audit.create(
        {
          action: AuditAction.CREATED,
          entity: AuditEntity.INVESTIGATION,
          entityId: investigation.id,
          description: `Investigation opened for incident: ${incident.title}`,
          metadata: {
            incidentId,
          },
        },
        tx,
      );

      return investigation;
    });
  }

  async findAll(query: QueryInvestigationsDto) {
    const { skip = 0, take = 25, status, assignedTo } = query;

    const where = {
      ...(status ? { status } : {}),
      ...(assignedTo ? { assignedTo } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.investigation.findMany({
        where,
        skip,
        take,
        include: {
          incident: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.investigation.count({ where }),
    ]);

    return paginated(data, total, skip, take);
  }

  /*
   * Reaching a terminal status stamps completedAt; reopening an
   * investigation clears it again so the field always reflects status.
   */
  private static readonly TERMINAL_STATUSES = ['RESOLVED', 'CLOSED'];

  async update(id: string, dto: UpdateInvestigationDto) {
    const existing = await this.prisma.investigation.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Investigation not found');
    }

    const statusChanged =
      dto.status !== undefined && dto.status !== existing.status;

    let completedAt = existing.completedAt;

    if (statusChanged) {
      const isTerminal = InvestigationsService.TERMINAL_STATUSES.includes(
        dto.status as string,
      );

      completedAt = isTerminal ? (existing.completedAt ?? new Date()) : null;
    }

    return this.prisma.$transaction(async (tx) => {
      const investigation = await tx.investigation.update({
        where: {
          id,
        },
        data: {
          ...dto,
          completedAt,
        },
      });

      await this.audit.create(
        statusChanged
          ? {
              action: AuditAction.STATUS_CHANGED,
              entity: AuditEntity.INVESTIGATION,
              entityId: investigation.id,
              description: `Investigation status changed: ${existing.status} to ${investigation.status}`,
              metadata: {
                from: existing.status,
                to: investigation.status,
                incidentId: investigation.incidentId,
              },
            }
          : {
              action: AuditAction.UPDATED,
              entity: AuditEntity.INVESTIGATION,
              entityId: investigation.id,
              description: 'Investigation updated',
              metadata: {
                fields: Object.keys(dto),
                incidentId: investigation.incidentId,
              },
            },
        tx,
      );

      return investigation;
    });
  }

  async findOne(id: string) {
    const investigation = await this.prisma.investigation.findUnique({
      where: {
        id,
      },
      include: {
        incident: true,
      },
    });

    if (!investigation) {
      throw new NotFoundException('Investigation not found');
    }

    return investigation;
  }

  async getTimeline(investigationId: string) {
    const investigation = await this.prisma.investigation.findUnique({
      where: {
        id: investigationId,
      },
    });

    if (!investigation) {
      throw new NotFoundException('Investigation not found');
    }

    const incidentId = investigation.incidentId;

    const [incident, alerts, evidence, auditLogs] = await Promise.all([
      this.prisma.incident.findUnique({
        where: {
          id: incidentId,
        },
      }),

      this.prisma.alert.findMany({
        where: {
          incidentId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      }),

      this.prisma.evidence.findMany({
        where: {
          incidentId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      }),

      this.prisma.auditLog.findMany({
        where: {
          OR: [
            { entity: AuditEntity.INCIDENT, entityId: incidentId },
            {
              entity: AuditEntity.INVESTIGATION,
              entityId: investigationId,
            },
          ],
        },
        orderBy: {
          createdAt: 'asc',
        },
      }),
    ]);

    const timeline = [
      ...(incident
        ? [
            {
              timestamp: incident.createdAt,
              type: 'INCIDENT',
              action: 'CREATED',
              description: incident.title,
            },
          ]
        : []),

      ...alerts.map((alert) => ({
        timestamp: alert.createdAt,
        type: 'ALERT',
        action: 'CREATED',
        description: alert.title,
      })),

      ...evidence.map((item) => ({
        timestamp: item.createdAt,
        type: 'EVIDENCE',
        action: 'ADDED',
        description: item.description ?? item.value,
      })),

      /*
       * Incident creation is already represented above from the incident
       * record itself, so its audit entry is skipped here to avoid a
       * duplicate row in the timeline.
       */
      ...auditLogs
        .filter(
          (log) =>
            !(
              log.entity === AuditEntity.INCIDENT &&
              log.action === AuditAction.CREATED
            ),
        )
        .map((log) => ({
          timestamp: log.createdAt,
          type: 'AUDIT',
          action: log.action,
          description: log.description ?? '',
        })),
    ];

    return timeline.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
  }

  async getSummary(investigationId: string) {
    const investigation = await this.prisma.investigation.findUnique({
      where: {
        id: investigationId,
      },
      include: {
        incident: {
          include: {
            alerts: {
              orderBy: {
                createdAt: 'asc',
              },
            },

            evidence: {
              orderBy: {
                createdAt: 'asc',
              },
            },

            assets: {
              include: {
                asset: true,
              },
            },
          },
        },

        findings: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!investigation) {
      throw new NotFoundException('Investigation not found');
    }

    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          {
            entity: AuditEntity.INCIDENT,
            entityId: investigation.incidentId,
          },
          {
            entity: AuditEntity.INVESTIGATION,
            entityId: investigation.id,
          },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      investigation: {
        id: investigation.id,
        status: investigation.status,
        assignedTo: investigation.assignedTo,
        startedAt: investigation.startedAt,
        completedAt: investigation.completedAt,
        conclusion: investigation.conclusion,
        createdAt: investigation.createdAt,
        updatedAt: investigation.updatedAt,
      },

      incident: investigation.incident,

      alerts: investigation.incident.alerts,

      evidence: investigation.incident.evidence,

      assets: investigation.incident.assets.map((item) => item.asset),

      findings: investigation.findings,

      auditLogs,

      timeline: await this.getTimeline(investigationId),
    };
  }

  async getCorrelations(investigationId: string) {
    return this.correlations.getInvestigationCorrelations(investigationId);
  }

  async getRisk(investigationId: string) {
    return this.riskScore.getForInvestigation(investigationId);
  }

  async getExplanation(investigationId: string) {
    const ctx = await this.context.load(investigationId);
    const risk = this.riskScore.calculate(ctx);

    const factors: string[] = [];

    const severityRank = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

    const highestSeverity = severityRank.find((severity) =>
      ctx.alerts.some((alert) => alert.severity === severity),
    );

    if (highestSeverity) {
      factors.push(`${highestSeverity} severity alert detected`);
    }

    if (ctx.alerts.some((alert) => Boolean(alert.sourceIp))) {
      factors.push('External source IP observed');
    }

    if (ctx.assets.length > 0) {
      factors.push(
        `${ctx.assets.length} affected asset${
          ctx.assets.length > 1 ? 's' : ''
        } identified`,
      );
    }

    if (ctx.evidence.length > 0) {
      factors.push(
        `${ctx.evidence.length} supporting evidence item${
          ctx.evidence.length > 1 ? 's' : ''
        } available`,
      );
    }

    if (ctx.findings.some((finding) => finding.confidence === 'HIGH')) {
      factors.push('High-confidence finding exists');
    }

    const summaries: Record<typeof risk.level, string> = {
      CRITICAL:
        'This investigation is rated CRITICAL because multiple high-risk indicators are present, including significant alerts, affected assets, and supporting investigation evidence.',
      HIGH: 'This investigation is rated HIGH because significant security indicators and supporting evidence are present.',
      MEDIUM:
        'This investigation is rated MEDIUM because security indicators are present but the available evidence does not currently indicate the highest level of risk.',
      LOW: 'This investigation is currently rated LOW based on the available security indicators and evidence.',
    };

    return {
      investigationId,
      risk: {
        score: risk.score,
        level: risk.level,
      },
      explanation: {
        summary: summaries[risk.level],
        factors,
      },
    };
  }
}
