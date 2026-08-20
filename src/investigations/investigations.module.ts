import { Module } from '@nestjs/common';
import { InvestigationsController } from './investigations.controller';
import { InvestigationsService } from './investigations.service';
import { InvestigationEventsService } from './investigation-events.service';

@Module({
  controllers: [InvestigationsController],
  providers: [
  InvestigationsService,
  InvestigationEventsService,
],
})
export class InvestigationsModule {}
