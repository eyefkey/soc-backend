import { Test, TestingModule } from '@nestjs/testing';
import { InvestigationsService } from './investigations.service';
import { PrismaService } from '../prisma/prisma.service';
import { CorrelationsService } from '../correlations/correlations.service';
import { InvestigationContextService } from '../correlations/investigation-context.service';
import { RiskScoreService } from '../correlations/risk-score.service';
import { AuditService } from '../audit/audit.service';

describe('InvestigationsService', () => {
  let service: InvestigationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestigationsService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: InvestigationContextService,
          useValue: {},
        },
        {
          provide: CorrelationsService,
          useValue: {},
        },
        {
          provide: RiskScoreService,
          useValue: {},
        },
        {
          provide: AuditService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<InvestigationsService>(InvestigationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
