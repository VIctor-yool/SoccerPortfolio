import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RankingsController } from './rankings.controller';
import { RankingsService } from './rankings.service';
import { Match } from '../matches/entities/match.entity';
import { MatchRecord } from '../matches/entities/match-record.entity';
import { MatchAttendance } from '../matches/entities/match-attendance.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Match,
      MatchRecord,
      MatchAttendance,
      TeamMember,
      User,
    ]),
  ],
  controllers: [RankingsController],
  providers: [RankingsService],
  exports: [RankingsService],
})
export class RankingsModule {}

