import { Injectable } from '@nestjs/common';
import { Severity } from '../../generated/prisma/enums';

@Injectable()
export class RiskScoreService {
  calculate(
    severity: Severity,
    correlationCount: number,
  ) {
    const severityScore: Record<Severity, number> = {
      LOW: 20,
      MEDIUM: 40,
      HIGH: 70,
      CRITICAL: 90,
    };

    let score = severityScore[severity];

    score += Math.min(correlationCount * 5, 10);

    score = Math.min(score, 100);

    let level: string;

    if (score >= 80) {
      level = 'CRITICAL';
    } else if (score >= 60) {
      level = 'HIGH';
    } else if (score >= 40) {
      level = 'MEDIUM';
    } else {
      level = 'LOW';
    }

    return {
      score,
      level,
    };
  }
}
