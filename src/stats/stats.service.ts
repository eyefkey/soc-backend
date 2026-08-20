import { Injectable } from '@nestjs/common';

import {
  AssetStatus,
  IncidentStatus,
  MitreTactic,
  Severity,
} from '../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { QueryStatsDto } from './dto/query-stats.dto';

/*
 * Anything the incident queue does not already carry. The console header
 * needs counts and two charts on every load; without this it would fetch
 * whole collections and total them in the browser.
 */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(query: QueryStatsDto) {
    const windowMinutes = query.windowMinutes ?? 60;
    const buckets = query.buckets ?? 12;

    const since = new Date(Date.now() - windowMinutes * 60_000);
    const tacticSince = new Date(Date.now() - 24 * 60 * 60_000);

    const [
      openIncidents,
      incidentsBySeverity,
      activeAssets,
      compromisedAssets,
      quarantinedAssets,
      iocCount,
      openInvestigations,
      unassignedInvestigations,
      recentAlerts,
      tacticCounts,
    ] = await Promise.all([
      this.prisma.incident.count({
        where: {
          status: {
            in: [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING],
          },
        },
      }),

      this.prisma.incident.groupBy({
        by: ['severity'],
        where: {
          status: {
            in: [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING],
          },
        },
        _count: true,
      }),

      this.prisma.asset.count({ where: { status: AssetStatus.ACTIVE } }),
      this.prisma.asset.count({ where: { status: AssetStatus.COMPROMISED } }),
      this.prisma.asset.count({ where: { status: AssetStatus.QUARANTINED } }),

      /*
       * "IOCs" means the evidence types that are actually indicators;
       * a screenshot or a free-text note is not one.
       */
      this.prisma.evidence.count({
        where: {
          type: {
            in: ['IP_ADDRESS', 'DOMAIN', 'URL', 'FILE_HASH'],
          },
        },
      }),

      this.prisma.investigation.count({
        where: {
          status: {
            in: ['OPEN', 'INVESTIGATING'],
          },
        },
      }),

      this.prisma.investigation.count({
        where: {
          assignedTo: null,
          status: {
            in: ['OPEN', 'INVESTIGATING'],
          },
        },
      }),

      this.prisma.alert.findMany({
        where: {
          createdAt: {
            gte: since,
          },
        },
        select: {
          createdAt: true,
          severity: true,
        },
      }),

      this.prisma.alert.groupBy({
        by: ['tactic'],
        where: {
          createdAt: {
            gte: tacticSince,
          },
          tactic: {
            not: null,
          },
        },
        _count: true,
      }),
    ]);

    return {
      incidents: {
        open: openIncidents,
        bySeverity: this.countsBySeverity(incidentsBySeverity),
      },

      assets: {
        active: activeAssets,
        compromised: compromisedAssets,
        quarantined: quarantinedAssets,
      },

      indicators: {
        total: iocCount,
      },

      investigations: {
        open: openInvestigations,
        unassigned: unassignedInvestigations,
      },

      activity: {
        windowMinutes,
        series: this.bucketAlerts(recentAlerts, since, windowMinutes, buckets),
      },

      tactics: tacticCounts
        .filter((row): row is typeof row & { tactic: MitreTactic } =>
          Boolean(row.tactic),
        )
        .map((row) => ({
          tactic: row.tactic,
          count: row._count,
        }))
        .sort((a, b) => b.count - a.count),
    };
  }

  private countsBySeverity(
    rows: Array<{ severity: Severity; _count: number }>,
  ): Record<Severity, number> {
    const empty: Record<Severity, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    return rows.reduce(
      (totals, row) => ({ ...totals, [row.severity]: row._count }),
      empty,
    );
  }

  /*
   * Buckets alerts into equal slices across the window so the activity
   * chart has a point per slice even where nothing fired — a gap in the
   * line would otherwise read as missing data rather than a quiet period.
   */
  private bucketAlerts(
    alerts: Array<{ createdAt: Date; severity: Severity }>,
    since: Date,
    windowMinutes: number,
    buckets: number,
  ) {
    const sliceMs = (windowMinutes * 60_000) / buckets;

    const series = Array.from({ length: buckets }, (_, index) => ({
      at: new Date(since.getTime() + index * sliceMs).toISOString(),
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    }));

    for (const alert of alerts) {
      const offset = alert.createdAt.getTime() - since.getTime();
      const index = Math.min(Math.floor(offset / sliceMs), buckets - 1);

      if (index >= 0) {
        series[index][alert.severity] += 1;
      }
    }

    return series;
  }
}
