import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvestigationsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(incidentId: string) {
    const incident = await this.prisma.incident.findUnique({
      where: {
        id: incidentId,
      },
    });

    if (!incident) {
      throw new NotFoundException(
        'Incident not found',
      );
    }

    const existing =
      await this.prisma.investigation.findUnique({
        where: {
          incidentId,
        },
      });

    if (existing) {
      return existing;
    }

    return this.prisma.investigation.create({
      data: {
        incidentId,
      },
    });
  }

  async findAll() {
    return this.prisma.investigation.findMany({
      include: {
        incident: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const investigation =
      await this.prisma.investigation.findUnique({
        where: {
          id,
        },
        include: {
          incident: true,
        },
      });

    if (!investigation) {
      throw new NotFoundException(
        'Investigation not found',
      );
    }

    return investigation;
  }

  async getTimeline(investigationId: string) {
    const investigation =
      await this.prisma.investigation.findUnique({
        where: {
          id: investigationId,
        },
      });

    if (!investigation) {
      throw new NotFoundException(
        'Investigation not found',
      );
    }

    const incidentId = investigation.incidentId;

    const [
      incident,
      alerts,
      evidence,
      auditLogs,
    ] = await Promise.all([
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
          entity: 'INCIDENT',
          entityId: incidentId,
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
        description:
          item.description ?? item.value,
      })),

      ...auditLogs.map((log) => ({
        timestamp: log.createdAt,
        type: 'AUDIT',
        action: log.action,
        description: log.description ?? '',
      })),
    ];

    return timeline.sort(
      (a, b) =>
        a.timestamp.getTime() -
        b.timestamp.getTime(),
    );
  }

  async getSummary(investigationId: string) {
    const investigation =
      await this.prisma.investigation.findUnique({
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
      throw new NotFoundException(
        'Investigation not found',
      );
    }

    const auditLogs =
      await this.prisma.auditLog.findMany({
        where: {
          entity: 'INCIDENT',
          entityId: investigation.incidentId,
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

      assets: investigation.incident.assets.map(
        (item) => item.asset,
      ),

      findings: investigation.findings,

      auditLogs,

      timeline:
        await this.getTimeline(
          investigationId,
        ),
    };
  }

async getCorrelations(investigationId: string) {
  const investigation =
    await this.prisma.investigation.findUnique({
      where: {
        id: investigationId,
      },
      include: {
        incident: {
          include: {
            alerts: true,
            evidence: true,
            assets: {
              include: {
                asset: true,
              },
            },
          },
        },
        findings: true,
      },
    });

  if (!investigation) {
    throw new NotFoundException(
      'Investigation not found',
    );
  }

  const correlations: Array<{
    type: string;
    sourceId: string;
    targetId: string;
    confidence: string;
    reason: string;
  }> = [];

  const alerts = investigation.incident.alerts;
  const evidence = investigation.incident.evidence;
  const assets = investigation.incident.assets.map(
    (item) => item.asset,
  );
  const findings = investigation.findings;

  /*
   * RULE 1
   * Alert → Asset
   *
   * Alert target IP matches Asset IP.
   */
  for (const alert of alerts) {
    if (!alert.targetIp) {
      continue;
    }

    for (const asset of assets) {
      if (
        asset.ipAddress &&
        asset.ipAddress === alert.targetIp
      ) {
        correlations.push({
          type: 'ALERT_ASSET',
          sourceId: alert.id,
          targetId: asset.id,
          confidence: 'HIGH',
          reason:
            'Alert target IP matches asset IP',
        });
      }
    }
  }

  /*
   * RULE 2
   * Alert → Evidence
   *
   * Alert source/target IP appears in evidence.
   */
  for (const alert of alerts) {
    const alertIps = [
      alert.sourceIp,
      alert.targetIp,
    ].filter(
      (ip): ip is string => Boolean(ip),
    );

    for (const item of evidence) {
      const matched = alertIps.some((ip) =>
        item.value.includes(ip),
      );

      if (matched) {
        correlations.push({
          type: 'ALERT_EVIDENCE',
          sourceId: alert.id,
          targetId: item.id,
          confidence: 'HIGH',
          reason:
            'Alert IP appears in evidence',
        });
      }
    }
  }

  /*
   * RULE 3
   * Evidence → Asset
   *
   * Evidence contains the asset IP.
   */
  for (const item of evidence) {
    for (const asset of assets) {
      if (
        asset.ipAddress &&
        item.value.includes(asset.ipAddress)
      ) {
        correlations.push({
          type: 'EVIDENCE_ASSET',
          sourceId: item.id,
          targetId: asset.id,
          confidence: 'HIGH',
          reason:
            'Evidence contains asset IP',
        });
      }
    }
  }

  /*
   * RULE 4
   * Finding → Investigation
   *
   * Findings already belong directly to this
   * investigation.
   */
  for (const finding of findings) {
    correlations.push({
      type: 'INVESTIGATION_FINDING',
      sourceId: investigation.id,
      targetId: finding.id,
      confidence: finding.confidence,
      reason:
        'Finding belongs to investigation',
    });
  }

  return {
    investigationId,
    correlations,
  };
}

async getRisk(investigationId: string) {
  const investigation =
    await this.prisma.investigation.findUnique({
      where: {
        id: investigationId,
      },
      include: {
        incident: {
          include: {
            alerts: true,
            evidence: true,
            assets: {
              include: {
                asset: true,
              },
            },
          },
        },
        findings: true,
      },
    });

  if (!investigation) {
    throw new NotFoundException(
      'Investigation not found',
    );
  }

  let score = 0;

  const factors: Array<{
    name: string;
    points: number;
    reason: string;
  }> = [];

  /*
   * ALERT SEVERITY
   */
  for (const alert of investigation.incident.alerts) {
    let points = 0;

    switch (alert.severity) {
      case 'CRITICAL':
        points = 35;
        break;

      case 'HIGH':
        points = 25;
        break;

      case 'MEDIUM':
        points = 15;
        break;

      case 'LOW':
        points = 5;
        break;
    }

    score += points;

    factors.push({
      name: 'Alert severity',
      points,
      reason: `${alert.severity} severity alert: ${alert.title}`,
    });
  }

  /*
   * EXTERNAL SOURCE IP
   */
  for (const alert of investigation.incident.alerts) {
    if (alert.sourceIp) {
      score += 15;

      factors.push({
        name: 'External source IP',
        points: 15,
        reason: `Source IP observed: ${alert.sourceIp}`,
      });

      break;
    }
  }

  /*
   * TARGETED ASSET
   */
  if (
    investigation.incident.assets.length > 0
  ) {
    score += 20;

    factors.push({
      name: 'Targeted asset',
      points: 20,
      reason:
        'Investigation contains one or more affected assets',
    });
  }

  /*
   * CORRELATED EVIDENCE
   */
  if (
    investigation.incident.evidence.length > 0
  ) {
    score += 15;

    factors.push({
      name: 'Evidence available',
      points: 15,
      reason:
        'Investigation contains supporting evidence',
    });
  }

  /*
   * MULTIPLE ALERTS
   */
  if (
    investigation.incident.alerts.length > 1
  ) {
    score += 10;

    factors.push({
      name: 'Multiple alerts',
      points: 10,
      reason: `${investigation.incident.alerts.length} alerts associated with incident`,
    });
  }

  /*
   * HIGH-CONFIDENCE FINDING
   */
  const highConfidenceFinding =
    investigation.findings.some(
      (finding) =>
        finding.confidence === 'HIGH',
    );

  if (highConfidenceFinding) {
    score += 15;

    factors.push({
      name: 'High-confidence finding',
      points: 15,
      reason:
        'Investigation contains a high-confidence finding',
    });
  }

  /*
   * CAP SCORE
   */
  score = Math.min(score, 100);

  /*
   * DETERMINE RISK LEVEL
   */
  let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  if (score >= 80) {
    level = 'CRITICAL';
  } else if (score >= 60) {
    level = 'HIGH';
  } else if (score >= 30) {
    level = 'MEDIUM';
  } else {
    level = 'LOW';
  }

  return {
    investigationId,
    score,
    level,
    factors,
  };
}

async getExplanation(investigationId: string) {
  const investigation =
    await this.prisma.investigation.findUnique({
      where: {
        id: investigationId,
      },
      include: {
        incident: {
          include: {
            alerts: true,
            evidence: true,
            assets: {
              include: {
                asset: true,
              },
            },
          },
        },
        findings: true,
      },
    });

  if (!investigation) {
    throw new NotFoundException(
      'Investigation not found',
    );
  }

  const risk = await this.getRisk(
    investigationId,
  );

  const factors: string[] = [];

  /*
   * ALERTS
   */
  const alerts = investigation.incident.alerts;

  if (alerts.length > 0) {
    const highestSeverity = alerts.some(
      (alert) => alert.severity === 'CRITICAL',
    )
      ? 'CRITICAL'
      : alerts.some(
            (alert) => alert.severity === 'HIGH',
          )
        ? 'HIGH'
        : alerts.some(
              (alert) =>
                alert.severity === 'MEDIUM',
            )
          ? 'MEDIUM'
          : 'LOW';

    factors.push(
      `${highestSeverity} severity alert detected`,
    );
  }

  /*
   * SOURCE IP
   */
  const externalSource = alerts.some(
    (alert) => Boolean(alert.sourceIp),
  );

  if (externalSource) {
    factors.push(
      'External source IP observed',
    );
  }

  /*
   * ASSETS
   */
  const assets =
    investigation.incident.assets;

  if (assets.length > 0) {
    factors.push(
      `${assets.length} affected asset${
        assets.length > 1 ? 's' : ''
      } identified`,
    );
  }

  /*
   * EVIDENCE
   */
  const evidence =
    investigation.incident.evidence;

  if (evidence.length > 0) {
    factors.push(
      `${evidence.length} supporting evidence item${
        evidence.length > 1 ? 's' : ''
      } available`,
    );
  }

  /*
   * FINDINGS
   */
  const highConfidenceFinding =
    investigation.findings.some(
      (finding) =>
        finding.confidence === 'HIGH',
    );

  if (highConfidenceFinding) {
    factors.push(
      'High-confidence finding exists',
    );
  }

  /*
   * SUMMARY
   */
  let summary: string;

  switch (risk.level) {
    case 'CRITICAL':
      summary =
        'This investigation is rated CRITICAL because multiple high-risk indicators are present, including significant alerts, affected assets, and supporting investigation evidence.';
      break;

    case 'HIGH':
      summary =
        'This investigation is rated HIGH because significant security indicators and supporting evidence are present.';
      break;

    case 'MEDIUM':
      summary =
        'This investigation is rated MEDIUM because security indicators are present but the available evidence does not currently indicate the highest level of risk.';
      break;

    default:
      summary =
        'This investigation is currently rated LOW based on the available security indicators and evidence.';
  }

  return {
    investigationId,
    risk: {
      score: risk.score,
      level: risk.level,
    },
    explanation: {
      summary,
      factors,
    },
  };
}
}
