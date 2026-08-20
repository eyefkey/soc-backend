import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationsService } from './correlations.service';

describe('CorrelationsService', () => {
  let service: CorrelationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CorrelationsService],
    }).compile();

    service = module.get<CorrelationsService>(CorrelationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
