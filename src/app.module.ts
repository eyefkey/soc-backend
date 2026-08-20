import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { RequestContextModule } from './common/request-context/request-context.module';
import { RequestContextMiddleware } from './common/request-context/request-context.middleware';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
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
    RequestContextModule,
    HealthModule,
    AuthModule,
    IncidentsModule,
    AlertsModule,
    AssetsModule,
    EvidenceModule,
    AuditModule,
    InvestigationsModule,
    FindingsModule,
    CorrelationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    /*
     * Authentication is on by default for every route; individual handlers
     * opt out with @Public(). Ordering matters — JwtAuthGuard populates the
     * user that RolesGuard then checks.
     */
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*splat');
  }
}
