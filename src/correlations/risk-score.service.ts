import { Injectable } from '@nestjs/common';

import { InvestigationContextService } from './investigation-context.service';
import { InvestigationContext } from './interfaces/investigation-context.interface';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskFactor {
  name: string;
  points: number;
  reason: string;
}

export interface RiskScore {
  investigationId: string;
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
}

const ALERT_SEVERITY_POINTS = {
  CRITICAL: 35,
  HIGH: 25,
  MEDIUM: 15,
  LOW: 5,
} as const;

@Injectable()
export class RiskScoreService {
  constructor(private readonly context: InvestigationContextService) {}

  async getForInvestigation(investigationId: string): Promise<RiskScore> {
    return this.calculate(await this.context.load(investigationId));
  }

  /*
   * Pure scoring over an already-loaded context. Kept free of Prisma so the
   * weighting can be unit tested without a database.
   */
  calculate(ctx: InvestigationContext): RiskScore {
    const factors: RiskFactor[] = [];
    let score = 0;

    const add = (name: string, points: number, reason: string) => {
      score += points;
      factors.push({ name, points, reason });
    };

    for (const alert of ctx.alerts) {
      add(
        'Alert severity',
        ALERT_SEVERITY_POINTS[alert.severity],
        `${alert.severity} severity alert: ${alert.title}`,
      );
    }

    const firstExternal = ctx.alerts.find((alert) => alert.sourceIp);

    if (firstExternal) {
      add(
        'External source IP',
        15,
        `Source IP observed: ${firstExternal.sourceIp}`,
      );
    }

    if (ctx.assets.length > 0) {
      add(
        'Targeted asset',
        20,
        'Investigation contains one or more affected assets',
      );
    }

    if (ctx.evidence.length > 0) {
      add(
        'Evidence available',
        15,
        'Investigation contains supporting evidence',
      );
    }

    if (ctx.alerts.length > 1) {
      add(
        'Multiple alerts',
        10,
        `${ctx.alerts.length} alerts associated with incident`,
      );
    }

    if (ctx.findings.some((finding) => finding.confidence === 'HIGH')) {
      add(
        'High-confidence finding',
        15,
        'Investigation contains a high-confidence finding',
      );
    }

    score = Math.min(score, 100);

    return {
      investigationId: ctx.investigationId,
      score,
      level: this.toLevel(score),
      factors,
    };
  }

  private toLevel(score: number): RiskLevel {
    if (score >= 80) {
      return 'CRITICAL';
    }

    if (score >= 60) {
      return 'HIGH';
    }

    if (score >= 30) {
      return 'MEDIUM';
    }

    return 'LOW';
  }
}
