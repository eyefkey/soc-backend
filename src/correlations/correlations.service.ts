import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RiskScoreService } from './risk-score.service';

@Injectable()
export class CorrelationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly riskScoreService: RiskScoreService,

  ) {}

  async getInvestigationCorrelations(
    investigationId: string,
  ) {
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
        },
      });

    if (!investigation) {
      throw new NotFoundException(
        'Investigation not found',
      );
    }

    const correlations: Array<{
      type: string;
      alertId: string;
      assetId?: string;
      evidenceId?: string;
      reason: string;
      confidence: string;
    }> = [];

    for (const alert of investigation.incident.alerts) {
  for (const evidence of investigation.incident.evidence) {
    const sourceMatches =
      alert.sourceIp &&
      evidence.type === 'IP_ADDRESS' &&
      alert.sourceIp === evidence.value;

    const targetMatches =
      alert.targetIp &&
      evidence.type === 'IP_ADDRESS' &&
      alert.targetIp === evidence.value;

    if (sourceMatches || targetMatches) {
      const matchedField = sourceMatches
        ? 'source IP'
        : 'target IP';

       correlations.push({
        type: 'ALERT_EVIDENCE',
        alertId: alert.id,
        evidenceId: evidence.id,
        reason:
          `Alert ${matchedField} matches evidence value`,
        confidence: 'HIGH',
      });
    }
  }
}

  const risk = this.riskScoreService.calculate(
  investigation.incident.severity,
  correlations.length,
);

return {
  investigationId,
  incidentId: investigation.incidentId,
  risk,
  correlations,
};
  }
}
