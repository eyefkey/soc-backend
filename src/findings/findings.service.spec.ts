import { Test, TestingModule } from '@nestjs/testing';
import { FindingsService } from './findings.service';

describe('FindingsService', () => {
  let service: FindingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FindingsService],
    }).compile();

    service = module.get<FindingsService>(FindingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
