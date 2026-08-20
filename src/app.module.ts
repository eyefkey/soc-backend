import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { IncidentsModule } from './incidents/incidents.module';
import { AlertsModule } from './alerts/alerts.module';
import { AssetsModule } from './assets/assets.module';
import { EvidenceModule } from './evidence/evidence.module';
import { AuditModule } from './audit/audit.module';
import { InvestigationsModule } from './investigations/investigations.module';
import { FindingsModule } from './findings/findings.module';
import { CorrelationsModule } from './correlations/correlations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    IncidentsModule,
    AlertsModule,
    AssetsModule,
    EvidenceModule,
    AuditModule,
    InvestigationsModule,
    FindingsModule,
    CorrelationsModule,
  ],
})
export class AppModule {}
