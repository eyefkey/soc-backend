import { Severity } from '../../../generated/prisma/enums';

export type InvestigationEventType =
  | 'INCIDENT'
  | 'ALERT'
  | 'EVIDENCE'
  | 'ASSET'
  | 'AUDIT';

export interface InvestigationEvent {
  id: string;
  timestamp: Date;

  type: InvestigationEventType;

  action: string;

  sourceId: string;

  description: string;

  severity?: Severity;

  metadata?: Record<string, unknown>;
}
