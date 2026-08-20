import { Test, TestingModule } from '@nestjs/testing';
import { InvestigationsController } from './investigations.controller';
import { InvestigationsService } from './investigations.service';
import { InvestigationEventsService } from './investigation-events.service';

describe('InvestigationsController', () => {
  let controller: InvestigationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvestigationsController],
      providers: [
        {
          provide: InvestigationsService,
          useValue: {},
        },
        {
          provide: InvestigationEventsService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<InvestigationsController>(InvestigationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
