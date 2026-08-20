import { Test, TestingModule } from '@nestjs/testing';
import { FindingsController } from './findings.controller';

describe('FindingsController', () => {
  let controller: FindingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FindingsController],
    }).compile();

    controller = module.get<FindingsController>(FindingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
