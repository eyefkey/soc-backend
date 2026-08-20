import { Test, TestingModule } from '@nestjs/testing';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

describe('EvidenceController', () => {
  let controller: EvidenceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvidenceController],
      providers: [
        {
          provide: EvidenceService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<EvidenceController>(EvidenceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
