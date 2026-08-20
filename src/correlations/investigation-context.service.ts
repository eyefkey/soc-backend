import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { InvestigationContext } from './interfaces/investigation-context.interface';

@Injectable()
export class InvestigationContextService {
  constructor(private readonly prisma: PrismaService) {}

  async load(investigationId: string): Promise<InvestigationContext> {
    const investigation = await this.prisma.investigation.findUnique({
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
      throw new NotFoundException('Investigation not found');
    }

    return {
      investigationId: investigation.id,
      incidentId: investigation.incidentId,
      alerts: investigation.incident.alerts,
      evidence: investigation.incident.evidence,
      assets: investigation.incident.assets.map((item) => item.asset),
      findings: investigation.findings,
    };
  }
}
