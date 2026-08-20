import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  InvestigationEvent,
  InvestigationEventType,
} from './interfaces/investigation-event.interface';

@Injectable()
export class InvestigationEventsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getEvents(
    investigationId: string,
  ): Promise<InvestigationEvent[]> {
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

    const events: InvestigationEvent[] = [];

    const incident = investigation.incident;

    events.push({
      id: incident.id,
      timestamp: incident.createdAt,
      type: 'INCIDENT',
      action: 'CREATED',
      sourceId: incident.id,
      description: incident.title,
      severity: incident.severity,
    });

    for (const alert of incident.alerts) {
      events.push({
        id: alert.id,
        timestamp: alert.createdAt,
        type: 'ALERT',
        action: 'DETECTED',
        sourceId: alert.id,
        description: alert.title,
        severity: alert.severity,
        metadata: {
          source: alert.source,
          sourceIp: alert.sourceIp,
          targetIp: alert.targetIp,
        },
      });
    }

    for (const evidence of incident.evidence) {
      events.push({
        id: evidence.id,
        timestamp: evidence.createdAt,
        type: 'EVIDENCE',
        action: 'OBSERVED',
        sourceId: evidence.id,
        description:
          evidence.description ??
          evidence.value,
        metadata: {
          evidenceType: evidence.type,
          value: evidence.value,
        },
      });
    }

    for (const incidentAsset of incident.assets) {
      const asset = incidentAsset.asset;

      events.push({
        id: asset.id,
        timestamp: asset.createdAt,
        type: 'ASSET',
        action: 'ASSOCIATED',
        sourceId: asset.id,
        description: asset.name,
        metadata: {
          assetType: asset.type,
          status: asset.status,
          hostname: asset.hostname,
          ipAddress: asset.ipAddress,
        },
      });
    }

    events.sort(
      (a, b) =>
        a.timestamp.getTime() -
        b.timestamp.getTime(),
    );

    return events;
  }
}
