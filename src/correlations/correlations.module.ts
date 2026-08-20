import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CorrelationsController } from './correlations.controller';
import { CorrelationsService } from './correlations.service';
import { InvestigationContextService } from './investigation-context.service';
import { RiskScoreService } from './risk-score.service';

@Module({
  imports: [PrismaModule],
  controllers: [CorrelationsController],
  providers: [
    CorrelationsService,
    InvestigationContextService,
    RiskScoreService,
  ],
  exports: [CorrelationsService, InvestigationContextService, RiskScoreService],
})
export class CorrelationsModule {}
