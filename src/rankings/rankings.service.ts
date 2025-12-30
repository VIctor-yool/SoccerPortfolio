import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match, MatchStatus } from '../matches/entities/match.entity';
import { MatchRecord } from '../matches/entities/match-record.entity';
import { MatchAttendance, AttendanceStatus } from '../matches/entities/match-attendance.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class RankingsService {
  constructor(
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(MatchRecord)
    private matchRecordRepository: Repository<MatchRecord>,
    @InjectRepository(MatchAttendance)
    private matchAttendanceRepository: Repository<MatchAttendance>,
    @InjectRepository(TeamMember)
    private teamMemberRepository: Repository<TeamMember>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getRankings(teamId: string) {
    const attendanceRanking = await this.getAttendanceRanking(teamId);
    const gameRanking = await this.getGameRanking(teamId);
    const goalsRanking = await this.getGoalsRanking(teamId);
    const assistsRanking = await this.getAssistsRanking(teamId);

    return {
      attendance: attendanceRanking,
      games: gameRanking,
      goals: goalsRanking,
      assists: assistsRanking,
    };
  }

  async getAttendanceRanking(teamId: string) {
    const teamMembers = await this.teamMemberRepository.find({
      where: { teamId },
      relations: ['user'],
    });

    const memberIds = teamMembers.map((m) => m.userId);

    const finishedMatches = await this.matchRepository.find({
      where: { teamId, status: MatchStatus.FINISHED },
    });

    const matchIds = finishedMatches.map((m) => m.id);

    const attendances = await this.matchAttendanceRepository
      .createQueryBuilder('attendance')
      .select('attendance.userId', 'userId')
      .addSelect(
        'SUM(CASE WHEN attendance.status = :attending THEN 1 ELSE 0 END)',
        'attendingCount',
      )
      .where('attendance.userId IN (:...memberIds)', { memberIds })
      .andWhere('attendance.matchId IN (:...matchIds)', { matchIds })
      .setParameter('attending', AttendanceStatus.ATTENDING)
      .groupBy('attendance.userId')
      .orderBy('attendingCount', 'DESC')
      .limit(5)
      .getRawMany();

    return this.enrichWithUserInfo(attendances, teamMembers, 'attendingCount');
  }

  async getGameRanking(teamId: string) {
    const teamMembers = await this.teamMemberRepository.find({
      where: { teamId },
      relations: ['user'],
    });

    const memberIds = teamMembers.map((m) => m.userId);

    const gameAppearances = await this.matchRecordRepository
      .createQueryBuilder('record')
      .select('record.userId', 'userId')
      .addSelect('COUNT(DISTINCT record.gameId)', 'count')
      .where('record.userId IN (:...memberIds)', { memberIds })
      .andWhere('record.played = true')
      .groupBy('record.userId')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    return this.enrichWithUserInfo(gameAppearances, teamMembers, 'count');
  }

  async getGoalsRanking(teamId: string) {
    const teamMembers = await this.teamMemberRepository.find({
      where: { teamId },
      relations: ['user'],
    });

    const memberIds = teamMembers.map((m) => m.userId);

    const goals = await this.matchRecordRepository
      .createQueryBuilder('record')
      .select('record.userId', 'userId')
      .addSelect('SUM(record.goals)', 'total')
      .where('record.userId IN (:...memberIds)', { memberIds })
      .groupBy('record.userId')
      .orderBy('total', 'DESC')
      .limit(5)
      .getRawMany();

    return this.enrichWithUserInfo(goals, teamMembers, 'total');
  }

  async getAssistsRanking(teamId: string) {
    const teamMembers = await this.teamMemberRepository.find({
      where: { teamId },
      relations: ['user'],
    });

    const memberIds = teamMembers.map((m) => m.userId);

    const assists = await this.matchRecordRepository
      .createQueryBuilder('record')
      .select('record.userId', 'userId')
      .addSelect('SUM(record.assists)', 'total')
      .where('record.userId IN (:...memberIds)', { memberIds })
      .groupBy('record.userId')
      .orderBy('total', 'DESC')
      .limit(5)
      .getRawMany();

    return this.enrichWithUserInfo(assists, teamMembers, 'total');
  }

  private enrichWithUserInfo(
    stats: any[],
    teamMembers: TeamMember[],
    valueKey: string,
  ) {
    return stats.map((stat, index) => {
      const member = teamMembers.find((m) => m.userId === stat.userId);
      return {
        rank: index + 1,
        userId: stat.userId,
        userName: member?.user.name || 'Unknown',
        value: parseInt(stat[valueKey]) || 0,
      };
    });
  }
}

