import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match, MatchStatus } from '../matches/entities/match.entity';
import { Game, GameResult } from '../matches/entities/game.entity';
import { MatchRecord } from '../matches/entities/match-record.entity';
import { TeamMember } from '../teams/entities/team-member.entity';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(MatchRecord)
    private matchRecordRepository: Repository<MatchRecord>,
    @InjectRepository(TeamMember)
    private teamMemberRepository: Repository<TeamMember>,
  ) {}

  async getTeamStatistics(teamId: string) {
    const matches = await this.matchRepository.find({
      where: { teamId, status: MatchStatus.FINISHED },
      relations: ['games'],
    });

    const games = await this.gameRepository.find({
      where: { match: { teamId, status: MatchStatus.FINISHED } },
    });

    // 경기별 통계
    const matchCount = matches.length;
    const matchWins = matches.filter((m) => {
      const matchGames = m.games || [];
      return matchGames.some((g) => g.result === GameResult.WIN);
    }).length;
    const matchDraws = matches.filter((m) => {
      const matchGames = m.games || [];
      return matchGames.every((g) => g.result === GameResult.DRAW);
    }).length;
    const matchLosses = matchCount - matchWins - matchDraws;

    const totalMatchGoals = matches.reduce(
      (sum, m) => sum + (m.totalOurScore || 0),
      0,
    );
    const totalMatchOpponentGoals = matches.reduce(
      (sum, m) => sum + (m.totalOpponentScore || 0),
      0,
    );

    const matchGoalsPerGame =
      matchCount > 0 ? totalMatchGoals / matchCount : 0;
    const matchOpponentGoalsPerGame =
      matchCount > 0 ? totalMatchOpponentGoals / matchCount : 0;

    const cleanSheetMatches = matches.filter(
      (m) => (m.totalOpponentScore || 0) === 0,
    ).length;
    const noGoalMatches = matches.filter(
      (m) => (m.totalOurScore || 0) === 0,
    ).length;

    const cleanSheetRatio = matchCount > 0 ? cleanSheetMatches / matchCount : 0;
    const noGoalRatio = matchCount > 0 ? noGoalMatches / matchCount : 0;

    // 게임별 통계
    const gameCount = games.length;
    const gameWins = games.filter((g) => g.result === GameResult.WIN).length;
    const gameDraws = games.filter((g) => g.result === GameResult.DRAW).length;
    const gameLosses = games.filter((g) => g.result === GameResult.LOSS).length;

    const totalGameGoals = games.reduce((sum, g) => sum + g.ourScore, 0);
    const totalGameOpponentGoals = games.reduce(
      (sum, g) => sum + g.opponentScore,
      0,
    );

    const gameGoalsPerGame = gameCount > 0 ? totalGameGoals / gameCount : 0;
    const gameOpponentGoalsPerGame =
      gameCount > 0 ? totalGameOpponentGoals / gameCount : 0;

    const cleanSheetGames = games.filter((g) => g.opponentScore === 0).length;
    const noGoalGames = games.filter((g) => g.ourScore === 0).length;

    const cleanSheetGameRatio = gameCount > 0 ? cleanSheetGames / gameCount : 0;
    const noGoalGameRatio = gameCount > 0 ? noGoalGames / gameCount : 0;

    // 총 득실
    const allRecords = await this.matchRecordRepository.find({
      where: { match: { teamId, status: MatchStatus.FINISHED } },
    });

    const totalGoals = allRecords.reduce((sum, r) => sum + r.goals, 0);
    const totalAssists = allRecords.reduce((sum, r) => sum + r.assists, 0);
    const fieldGoals = allRecords.filter(
      (r) => r.goalType === 'field',
    ).length;
    const freeKickGoals = allRecords.filter(
      (r) => r.goalType === 'free_kick',
    ).length;
    const penaltyGoals = allRecords.filter(
      (r) => r.goalType === 'penalty',
    ).length;
    const ownGoals = allRecords.filter((r) => r.goalType === 'own_goal').length;

    return {
      matchStatistics: {
        matchCount,
        wins: matchWins,
        draws: matchDraws,
        losses: matchLosses,
        goalsPerMatch: Math.round(matchGoalsPerGame * 10) / 10,
        opponentGoalsPerMatch: Math.round(matchOpponentGoalsPerGame * 10) / 10,
        cleanSheetRatio: Math.round(cleanSheetRatio * 100) / 100,
        noGoalRatio: Math.round(noGoalRatio * 100) / 100,
        cleanSheetMatches,
        noGoalMatches,
      },
      gameStatistics: {
        gameCount,
        wins: gameWins,
        draws: gameDraws,
        losses: gameLosses,
        goalsPerGame: Math.round(gameGoalsPerGame * 10) / 10,
        opponentGoalsPerGame: Math.round(gameOpponentGoalsPerGame * 10) / 10,
        cleanSheetRatio: Math.round(cleanSheetGameRatio * 100) / 100,
        noGoalRatio: Math.round(noGoalGameRatio * 100) / 100,
        cleanSheetGames,
        noGoalGames,
      },
      totalStatistics: {
        totalGoals,
        totalOpponentGoals: totalGameOpponentGoals,
        goalDifference: totalGoals - totalGameOpponentGoals,
        totalAssists,
        fieldGoals,
        freeKickGoals,
        penaltyGoals,
        ownGoals,
      },
    };
  }

  async getTop10(teamId: string) {
    const teamMembers = await this.teamMemberRepository.find({
      where: { teamId },
      relations: ['user'],
    });

    const memberIds = teamMembers.map((m) => m.userId);

    // 출전 수 Top10
    const gameAppearances = await this.matchRecordRepository
      .createQueryBuilder('record')
      .select('record.userId', 'userId')
      .addSelect('COUNT(DISTINCT record.gameId)', 'count')
      .where('record.userId IN (:...memberIds)', { memberIds })
      .andWhere('record.played = true')
      .groupBy('record.userId')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    // 득점 Top10
    const goals = await this.matchRecordRepository
      .createQueryBuilder('record')
      .select('record.userId', 'userId')
      .addSelect('SUM(record.goals)', 'total')
      .where('record.userId IN (:...memberIds)', { memberIds })
      .groupBy('record.userId')
      .orderBy('total', 'DESC')
      .limit(10)
      .getRawMany();

    // 도움 Top10
    const assists = await this.matchRecordRepository
      .createQueryBuilder('record')
      .select('record.userId', 'userId')
      .addSelect('SUM(record.assists)', 'total')
      .where('record.userId IN (:...memberIds)', { memberIds })
      .groupBy('record.userId')
      .orderBy('total', 'DESC')
      .limit(10)
      .getRawMany();

    // 승률 Top10 (최소 5경기 출전)
    const winRates = await this.matchRecordRepository
      .createQueryBuilder('record')
      .leftJoin('record.game', 'game')
      .select('record.userId', 'userId')
      .addSelect('COUNT(DISTINCT record.gameId)', 'totalGames')
      .addSelect(
        'SUM(CASE WHEN game.result = :win THEN 1 ELSE 0 END)',
        'wins',
      )
      .where('record.userId IN (:...memberIds)', { memberIds })
      .andWhere('record.played = true')
      .setParameter('win', GameResult.WIN)
      .groupBy('record.userId')
      .having('COUNT(DISTINCT record.gameId) >= 5')
      .getRawMany();

    const winRateTop10 = winRates
      .map((wr) => ({
        userId: wr.userId,
        winRate:
          parseInt(wr.totalGames) > 0
            ? parseInt(wr.wins) / parseInt(wr.totalGames)
            : 0,
        totalGames: parseInt(wr.totalGames),
        wins: parseInt(wr.wins),
      }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 10);

    return {
      gameAppearances: await this.enrichWithUserInfo(gameAppearances, teamMembers),
      goals: await this.enrichWithUserInfo(goals, teamMembers),
      assists: await this.enrichWithUserInfo(assists, teamMembers),
      winRates: await this.enrichWithUserInfo(winRateTop10, teamMembers),
    };
  }

  private async enrichWithUserInfo(
    stats: any[],
    teamMembers: TeamMember[],
  ) {
    return stats.map((stat) => {
      const member = teamMembers.find((m) => m.userId === stat.userId);
      return {
        userId: stat.userId,
        userName: member?.user.name || 'Unknown',
        value: stat.count || stat.total || stat.winRate || 0,
        ...(stat.totalGames && { totalGames: stat.totalGames }),
        ...(stat.wins && { wins: stat.wins }),
      };
    });
  }
}

