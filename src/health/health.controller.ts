import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { HealthService } from './health.service';
import { Public } from '../auth/decorators/public.decorator';

/*
 * Orchestrator probes poll frequently and must never be rate limited.
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  live() {
    return this.healthService.live();
  }

  @Public()
  @Get('ready')
  ready() {
    return this.healthService.ready();
  }
}
