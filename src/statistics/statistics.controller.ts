import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('statistics')
@UseGuards(JwtAuthGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('team')
  async getTeamStatistics(@Query('teamId') teamId: string) {
    return this.statisticsService.getTeamStatistics(teamId);
  }

  @Get('top10')
  async getTop10(@Query('teamId') teamId: string) {
    return this.statisticsService.getTop10(teamId);
  }
}

