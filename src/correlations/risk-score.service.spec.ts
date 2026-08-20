import { Test, TestingModule } from '@nestjs/testing';
import { RiskScoreService } from './risk-score.service';
import { InvestigationContextService } from './investigation-context.service';
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
    severity: 'LOW',
    source: 'edr',
    sourceIp: null,
    targetIp: null,
    createdAt: new Date(),
    incidentId: 'inc-1',
    ...over,
  }) as InvestigationContext['alerts'][number];

const asset = () =>
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
  }) as InvestigationContext['assets'][number];

describe('RiskScoreService', () => {
  let service: RiskScoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskScoreService,
        {
          provide: InvestigationContextService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<RiskScoreService>(RiskScoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('scores an empty investigation as LOW with no factors', () => {
    const result = service.calculate(ctx());

    expect(result).toMatchObject({
      investigationId: 'inv-1',
      score: 0,
      level: 'LOW',
      factors: [],
    });
  });

  it('weights alert severity', () => {
    const critical = service.calculate(
      ctx({ alerts: [alert({ severity: 'CRITICAL' })] }),
    );
    const low = service.calculate(
      ctx({ alerts: [alert({ severity: 'LOW' })] }),
    );

    expect(critical.score).toBe(35);
    expect(low.score).toBe(5);
  });

  it('counts an external source IP only once across many alerts', () => {
    const result = service.calculate(
      ctx({
        alerts: [
          alert({ id: 'a1', sourceIp: '1.1.1.1' }),
          alert({ id: 'a2', sourceIp: '2.2.2.2' }),
        ],
      }),
    );

    const external = result.factors.filter(
      (factor) => factor.name === 'External source IP',
    );

    expect(external).toHaveLength(1);
  });

  it('caps the score at 100', () => {
    const result = service.calculate(
      ctx({
        alerts: Array.from({ length: 10 }, (_, i) =>
          alert({ id: `a${i}`, severity: 'CRITICAL', sourceIp: '1.1.1.1' }),
        ),
        assets: [asset()],
      }),
    );

    expect(result.score).toBe(100);
    expect(result.level).toBe('CRITICAL');
  });

  it('maps scores to the documented bands', () => {
    // 3 CRITICAL alerts = 105 -> capped 100, plus multiple-alert bonus.
    expect(service.calculate(ctx({ alerts: [alert()] })).level).toBe('LOW');

    expect(
      service.calculate(ctx({ alerts: [alert({ severity: 'MEDIUM' })] })).level,
    ).toBe('LOW');

    expect(
      service.calculate(ctx({ alerts: [alert({ severity: 'CRITICAL' })] }))
        .level,
    ).toBe('MEDIUM');
  });
});
