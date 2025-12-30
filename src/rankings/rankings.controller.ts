import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RankingsService } from './rankings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('rankings')
@UseGuards(JwtAuthGuard)
export class RankingsController {
  constructor(private readonly rankingsService: RankingsService) {}

  @Get()
  async getRankings(@Query('teamId') teamId: string) {
    return this.rankingsService.getRankings(teamId);
  }

  @Get('attendance')
  async getAttendanceRanking(@Query('teamId') teamId: string) {
    return this.rankingsService.getAttendanceRanking(teamId);
  }

  @Get('games')
  async getGameRanking(@Query('teamId') teamId: string) {
    return this.rankingsService.getGameRanking(teamId);
  }

  @Get('goals')
  async getGoalsRanking(@Query('teamId') teamId: string) {
    return this.rankingsService.getGoalsRanking(teamId);
  }

  @Get('assists')
  async getAssistsRanking(@Query('teamId') teamId: string) {
    return this.rankingsService.getAssistsRanking(teamId);
  }
}

