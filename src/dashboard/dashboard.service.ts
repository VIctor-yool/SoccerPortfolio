import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Match, MatchStatus } from '../matches/entities/match.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { StatisticsService } from '../statistics/statistics.service';
import { RankingsService } from '../rankings/rankings.service';
import { AttendanceService } from '../attendance/attendance.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(TeamMember)
    private teamMemberRepository: Repository<TeamMember>,
    private statisticsService: StatisticsService,
    private rankingsService: RankingsService,
    private attendanceService: AttendanceService,
  ) {}

  async getSummary(teamId: string, userId: string) {
    // 다음 경기
    const nextMatch = await this.getNextMatch(teamId);

    // 팀 구성 요약
    const teamComposition = await this.getTeamComposition(teamId);

    // 팀 기록
    const teamStatistics = await this.statisticsService.getTeamStatistics(teamId);

    // Top10
    const top10 = await this.statisticsService.getTop10(teamId);

    // 출석 관리
    const attendanceSummary = await this.attendanceService.getSummary(teamId);

    return {
      nextMatch,
      teamComposition,
      teamStatistics,
      top10,
      attendanceSummary,
    };
  }

  private async getNextMatch(teamId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextMatch = await this.matchRepository.findOne({
      where: {
        teamId,
        date: MoreThan(today),
        status: MatchStatus.SCHEDULED,
      },
      order: { date: 'ASC' },
    });

    if (!nextMatch) {
      return null;
    }

    return {
      id: nextMatch.id,
      opponentTeamName: nextMatch.opponentTeamName,
      date: nextMatch.date,
      time: nextMatch.time,
      location: nextMatch.location,
    };
  }

  private async getTeamComposition(teamId: string) {
    const members = await this.teamMemberRepository.find({
      where: { teamId },
      relations: ['user', 'user.positions'],
    });

    const totalMembers = members.length;
    const positionCount = {
      GK: 0,
      DF: 0,
      MF: 0,
      FW: 0,
    };

    members.forEach((member) => {
      member.user.positions?.forEach((position) => {
        positionCount[position.position]++;
      });
    });

    return {
      totalMembers,
      positionCount,
    };
  }
}

