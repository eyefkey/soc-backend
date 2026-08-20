import { Controller, Get, Query } from '@nestjs/common';

import { StatsService } from './stats.service';
import { QueryStatsDto } from './dto/query-stats.dto';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  overview(@Query() query: QueryStatsDto) {
    return this.statsService.overview(query);
  }
}
