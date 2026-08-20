import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationsController } from './correlations.controller';

describe('CorrelationsController', () => {
  let controller: CorrelationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CorrelationsController],
    }).compile();

    controller = module.get<CorrelationsController>(CorrelationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
