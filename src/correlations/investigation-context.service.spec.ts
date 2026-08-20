import { Test, TestingModule } from '@nestjs/testing';
import { InvestigationContextService } from './investigation-context.service';
import { PrismaService } from '../prisma/prisma.service';

describe('InvestigationContextService', () => {
  let service: InvestigationContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestigationContextService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<InvestigationContextService>(
      InvestigationContextService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
