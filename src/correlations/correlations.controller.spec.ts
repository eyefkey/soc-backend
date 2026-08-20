import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationsController } from './correlations.controller';
import { CorrelationsService } from './correlations.service';

describe('CorrelationsController', () => {
  let controller: CorrelationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CorrelationsController],
      providers: [
        {
          provide: CorrelationsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<CorrelationsController>(CorrelationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
