import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';

import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

@Module({
  imports: [
    AuditModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('JWT_SECRET');

        /*
         * Fail at startup rather than fall back to a default: a shipped
         * default signing key would let anyone mint valid tokens.
         */
        if (!secret) {
          throw new Error('JWT_SECRET is required but was not set');
        }

        /*
         * Environment values arrive as plain strings; the ms-style duration
         * union is narrower than string, so the cast is made once here.
         */
        const expiresIn = (config.get<string>('JWT_EXPIRES_IN') ??
          '1h') as JwtSignOptions['expiresIn'];

        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService],
  exports: [JwtModule],
})
export class AuthModule {}
