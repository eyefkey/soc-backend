import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    /*
     * A broad ceiling for ordinary traffic. The credential endpoints set a
     * much tighter limit of their own with @Throttle.
     *
     * Counters are held in memory, so the limit is per instance: running
     * more than one replica needs a shared store.
     */
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60_000,
          limit: 120,
        },
      ],
      /*
       * Evaluated per request, so an end-to-end suite can switch limiting
       * on for the tests that assert it and leave it off for the rest
       * rather than burning its allowance on setup logins.
       */
      skipIf: () => process.env.THROTTLE_DISABLED === 'true',
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
    StatsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    /*
     * Guards run in registration order.
     *
     * Rate limiting comes first so a flood is rejected before it costs a
     * token verification or a database lookup — which matters most on the
     * login route, where each attempt runs a deliberately expensive hash.
     *
     * Authentication is then on by default for every route; handlers opt
     * out with @Public(). JwtAuthGuard populates the user that RolesGuard
     * subsequently checks.
     */
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
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
