import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CorrelationsModule } from '../correlations/correlations.module';
import { InvestigationsController } from './investigations.controller';
import { InvestigationsService } from './investigations.service';
import { InvestigationEventsService } from './investigation-events.service';

@Module({
  imports: [AuditModule, CorrelationsModule],
  controllers: [InvestigationsController],
  providers: [InvestigationsService, InvestigationEventsService],
})
export class InvestigationsModule {}
