import {
  AlertModel,
  AssetModel,
  EvidenceModel,
  FindingModel,
} from '../../../generated/prisma/models';

/*
 * Everything the correlation rules and the risk score need about one
 * investigation, loaded once so both can run off the same snapshot.
 */
export interface InvestigationContext {
  investigationId: string;
  incidentId: string;

  alerts: AlertModel[];
  evidence: EvidenceModel[];
  assets: AssetModel[];
  findings: FindingModel[];
}
