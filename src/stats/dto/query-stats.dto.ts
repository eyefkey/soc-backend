import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryStatsDto {
  /*
   * How far back the activity chart looks. Capped so a caller cannot ask
   * the database to scan a year of alerts to draw a sparkline.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1440)
  windowMinutes?: number = 60;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(120)
  buckets?: number = 12;
}
