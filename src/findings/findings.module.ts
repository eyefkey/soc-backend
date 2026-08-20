import { Module } from '@nestjs/common';

import { FindingsController } from './findings.controller';
import { FindingsService } from './findings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [FindingsController],
  providers: [FindingsService],
})
export class FindingsModule {}
