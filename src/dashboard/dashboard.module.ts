import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Match } from '../matches/entities/match.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { StatisticsModule } from '../statistics/statistics.module';
import { RankingsModule } from '../rankings/rankings.module';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Match, TeamMember]),
    StatisticsModule,
    RankingsModule,
    AttendanceModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

