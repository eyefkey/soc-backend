import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CorrelationsController } from './correlations.controller';
import { CorrelationsService } from './correlations.service';
import { RiskScoreService } from './risk-score.service';

@Module({
  imports: [PrismaModule],
  controllers: [CorrelationsController],
  providers: [
    CorrelationsService,
    RiskScoreService,
  ],
})
export class CorrelationsModule {}