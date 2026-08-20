import { Injectable } from '@nestjs/common';

import { InvestigationContextService } from './investigation-context.service';
import { RiskScore, RiskScoreService } from './risk-score.service';
import { InvestigationContext } from './interfaces/investigation-context.interface';

export interface Correlation {
  type:
    | 'ALERT_ASSET'
    | 'ALERT_EVIDENCE'
    | 'EVIDENCE_ASSET'
    | 'INVESTIGATION_FINDING';
  sourceId: string;
  targetId: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
}

export interface CorrelationResult {
  investigationId: string;
  incidentId: string;
  risk: RiskScore;
  correlations: Correlation[];
}

@Injectable()
export class CorrelationsService {
  constructor(
    private readonly context: InvestigationContextService,
    private readonly riskScore: RiskScoreService,
  ) {}

  async getInvestigationCorrelations(
    investigationId: string,
  ): Promise<CorrelationResult> {
    const ctx = await this.context.load(investigationId);

    return {
      investigationId: ctx.investigationId,
      incidentId: ctx.incidentId,
      risk: this.riskScore.calculate(ctx),
      correlations: this.correlate(ctx),
    };
  }

  /*
   * Pure rule evaluation over an already-loaded context, so the rules can be
   * unit tested without a database.
   */
  correlate(ctx: InvestigationContext): Correlation[] {
    const correlations: Correlation[] = [];

    /*
     * RULE 1 — Alert to Asset: alert target IP matches asset IP.
     */
    for (const alert of ctx.alerts) {
      if (!alert.targetIp) {
        continue;
      }

      for (const asset of ctx.assets) {
        if (asset.ipAddress && asset.ipAddress === alert.targetIp) {
          correlations.push({
            type: 'ALERT_ASSET',
            sourceId: alert.id,
            targetId: asset.id,
            confidence: 'HIGH',
            reason: 'Alert target IP matches asset IP',
          });
        }
      }
    }

    /*
     * RULE 2 — Alert to Evidence: an alert IP appears in the evidence value.
     */
    for (const alert of ctx.alerts) {
      const alertIps = [alert.sourceIp, alert.targetIp].filter(
        (ip): ip is string => Boolean(ip),
      );

      for (const item of ctx.evidence) {
        const matched = alertIps.find((ip) => item.value.includes(ip));

        if (matched) {
          correlations.push({
            type: 'ALERT_EVIDENCE',
            sourceId: alert.id,
            targetId: item.id,
            confidence: matched === item.value ? 'HIGH' : 'MEDIUM',
            reason:
              matched === item.value
                ? 'Alert IP matches evidence value'
                : 'Alert IP appears within evidence value',
          });
        }
      }
    }

    /*
     * RULE 3 — Evidence to Asset: evidence contains the asset IP.
     */
    for (const item of ctx.evidence) {
      for (const asset of ctx.assets) {
        if (asset.ipAddress && item.value.includes(asset.ipAddress)) {
          correlations.push({
            type: 'EVIDENCE_ASSET',
            sourceId: item.id,
            targetId: asset.id,
            confidence: 'HIGH',
            reason: 'Evidence contains asset IP',
          });
        }
      }
    }

    /*
     * RULE 4 — Finding to Investigation: findings belong to the
     * investigation directly, carrying their own stated confidence.
     */
    for (const finding of ctx.findings) {
      correlations.push({
        type: 'INVESTIGATION_FINDING',
        sourceId: ctx.investigationId,
        targetId: finding.id,
        confidence: finding.confidence,
        reason: 'Finding belongs to investigation',
      });
    }

    return correlations;
  }
}
