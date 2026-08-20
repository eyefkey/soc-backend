import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationsService } from './correlations.service';
import { InvestigationContextService } from './investigation-context.service';
import { RiskScoreService } from './risk-score.service';
import { InvestigationContext } from './interfaces/investigation-context.interface';

const ctx = (
  overrides: Partial<InvestigationContext> = {},
): InvestigationContext => ({
  investigationId: 'inv-1',
  incidentId: 'inc-1',
  alerts: [],
  evidence: [],
  assets: [],
  findings: [],
  ...overrides,
});

const alert = (over: Record<string, unknown> = {}) =>
  ({
    id: 'alert-1',
    title: 'Suspicious login',
    description: null,
    severity: 'HIGH',
    source: 'edr',
    sourceIp: null,
    targetIp: null,
    createdAt: new Date(),
    incidentId: 'inc-1',
    ...over,
  }) as InvestigationContext['alerts'][number];

const asset = (over: Record<string, unknown> = {}) =>
  ({
    id: 'asset-1',
    name: 'web-01',
    type: 'SERVER',
    status: 'ACTIVE',
    hostname: null,
    ipAddress: null,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as InvestigationContext['assets'][number];

const evidence = (over: Record<string, unknown> = {}) =>
  ({
    id: 'ev-1',
    type: 'IP_ADDRESS',
    value: '10.0.0.5',
    description: null,
    createdAt: new Date(),
    incidentId: 'inc-1',
    ...over,
  }) as InvestigationContext['evidence'][number];

const finding = (over: Record<string, unknown> = {}) =>
  ({
    id: 'find-1',
    title: 'Credential stuffing',
    description: 'Repeated failed logins',
    confidence: 'HIGH',
    impact: null,
    recommendation: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    investigationId: 'inv-1',
    ...over,
  }) as InvestigationContext['findings'][number];

describe('CorrelationsService', () => {
  let service: CorrelationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CorrelationsService,
        {
          provide: InvestigationContextService,
          useValue: {},
        },
        {
          provide: RiskScoreService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<CorrelationsService>(CorrelationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('links an alert to an asset when the target IP matches', () => {
    const result = service.correlate(
      ctx({
        alerts: [alert({ targetIp: '10.0.0.5' })],
        assets: [asset({ ipAddress: '10.0.0.5' })],
      }),
    );

    expect(result).toEqual([
      {
        type: 'ALERT_ASSET',
        sourceId: 'alert-1',
        targetId: 'asset-1',
        confidence: 'HIGH',
        reason: 'Alert target IP matches asset IP',
      },
    ]);
  });

  it('does not link an alert to an asset with a different IP', () => {
    const result = service.correlate(
      ctx({
        alerts: [alert({ targetIp: '10.0.0.5' })],
        assets: [asset({ ipAddress: '192.168.1.1' })],
      }),
    );

    expect(result).toEqual([]);
  });

  it('rates an exact evidence match higher than a substring match', () => {
    const exact = service.correlate(
      ctx({
        alerts: [alert({ sourceIp: '10.0.0.5' })],
        evidence: [evidence({ value: '10.0.0.5' })],
      }),
    );

    const partial = service.correlate(
      ctx({
        alerts: [alert({ sourceIp: '10.0.0.5' })],
        evidence: [
          evidence({ type: 'LOG', value: 'connection from 10.0.0.5 refused' }),
        ],
      }),
    );

    expect(exact[0].confidence).toBe('HIGH');
    expect(partial[0].confidence).toBe('MEDIUM');
  });

  it('carries the finding confidence through to the correlation', () => {
    const result = service.correlate(
      ctx({ findings: [finding({ confidence: 'LOW' })] }),
    );

    expect(result[0]).toMatchObject({
      type: 'INVESTIGATION_FINDING',
      sourceId: 'inv-1',
      targetId: 'find-1',
      confidence: 'LOW',
    });
  });

  it('returns nothing for an empty investigation', () => {
    expect(service.correlate(ctx())).toEqual([]);
  });
});
