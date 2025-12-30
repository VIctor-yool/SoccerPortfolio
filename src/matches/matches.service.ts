import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Match, MatchStatus } from './entities/match.entity';
import { Game, GameResult } from './entities/game.entity';
import { MatchRecord } from './entities/match-record.entity';
import { MatchAttendance, AttendanceStatus } from './entities/match-attendance.entity';
import { TeamMember, TeamMemberRole } from '../teams/entities/team-member.entity';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { RecordMatchDto, PlayerRecordDto } from './dto/record-match.dto';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(MatchRecord)
    private matchRecordRepository: Repository<MatchRecord>,
    @InjectRepository(MatchAttendance)
    private matchAttendanceRepository: Repository<MatchAttendance>,
    @InjectRepository(TeamMember)
    private teamMemberRepository: Repository<TeamMember>,
  ) {}

  async createMatch(userId: string, createMatchDto: CreateMatchDto) {
    await this.checkTeamPermission(createMatchDto.teamId, userId);

    const match = this.matchRepository.create({
      teamId: createMatchDto.teamId,
      opponentTeamName: createMatchDto.opponentTeamName,
      date: new Date(createMatchDto.date),
      time: createMatchDto.time,
      location: createMatchDto.location,
      status: MatchStatus.SCHEDULED,
    });

    return this.matchRepository.save(match);
  }

  async getMatches(teamId: string, year?: number, month?: number) {
    const queryBuilder = this.matchRepository
      .createQueryBuilder('match')
      .where('match.teamId = :teamId', { teamId })
      .leftJoinAndSelect('match.games', 'games')
      .orderBy('match.date', 'DESC');

    if (year && month) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      queryBuilder.andWhere('match.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const matches = await queryBuilder.getMany();

    return matches.map((match) => {
      const games = match.games || [];
      const wins = games.filter((g) => g.result === GameResult.WIN).length;
      const draws = games.filter((g) => g.result === GameResult.DRAW).length;
      const losses = games.filter((g) => g.result === GameResult.LOSS).length;
      const totalGoals = games.reduce((sum, g) => sum + g.ourScore, 0);
      const totalAssists = 0; // TODO: MatchRecord에서 계산
      const totalOpponentGoals = games.reduce(
        (sum, g) => sum + g.opponentScore,
        0,
      );

      return {
        id: match.id,
        opponentTeamName: match.opponentTeamName,
        date: match.date,
        gameCount: games.length,
        wins,
        draws,
        losses,
        totalGoals,
        totalAssists,
        totalOpponentGoals,
      };
    });
  }

  async getMatch(id: string) {
    const match = await this.matchRepository.findOne({
      where: { id },
      relations: ['games', 'games.records', 'games.records.user'],
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    const games = match.games || [];
    const totalOurScore = games.reduce((sum, g) => sum + g.ourScore, 0);
    const totalOpponentScore = games.reduce(
      (sum, g) => sum + g.opponentScore,
      0,
    );

    return {
      id: match.id,
      teamId: match.teamId,
      opponentTeamName: match.opponentTeamName,
      date: match.date,
      time: match.time,
      location: match.location,
      status: match.status,
      totalOurScore,
      totalOpponentScore,
      notes: match.notes,
      games: games.map((game) => ({
        id: game.id,
        gameNumber: game.gameNumber,
        ourScore: game.ourScore,
        opponentScore: game.opponentScore,
        result: game.result,
        records: game.records || [],
      })),
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    };
  }

  async updateMatch(id: string, userId: string, updateMatchDto: UpdateMatchDto) {
    const match = await this.matchRepository.findOne({
      where: { id },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    await this.checkTeamPermission(match.teamId, userId);

    if (updateMatchDto.opponentTeamName !== undefined) {
      match.opponentTeamName = updateMatchDto.opponentTeamName;
    }
    if (updateMatchDto.date !== undefined) {
      match.date = new Date(updateMatchDto.date);
    }
    if (updateMatchDto.time !== undefined) {
      match.time = updateMatchDto.time;
    }
    if (updateMatchDto.location !== undefined) {
      match.location = updateMatchDto.location;
    }
    if (updateMatchDto.status !== undefined) {
      match.status = updateMatchDto.status;
    }
    if (updateMatchDto.notes !== undefined) {
      match.notes = updateMatchDto.notes;
    }

    return this.matchRepository.save(match);
  }

  async deleteMatch(id: string, userId: string) {
    const match = await this.matchRepository.findOne({
      where: { id },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    await this.checkTeamPermission(match.teamId, userId);

    await this.matchRepository.remove(match);
    return { success: true };
  }

  async getMatchGames(matchId: string) {
    const games = await this.gameRepository.find({
      where: { matchId },
      relations: ['records', 'records.user'],
      order: { gameNumber: 'ASC' },
    });

    return games.map((game) => ({
      id: game.id,
      gameNumber: game.gameNumber,
      ourScore: game.ourScore,
      opponentScore: game.opponentScore,
      result: game.result,
      records: game.records || [],
    }));
  }

  async recordMatch(
    matchId: string,
    userId: string,
    recordMatchDto: RecordMatchDto,
  ) {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
      relations: ['games'],
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    await this.checkTeamPermission(match.teamId, userId);

    // 기존 게임 및 기록 삭제
    if (match.games && match.games.length > 0) {
      for (const game of match.games) {
        await this.matchRecordRepository.delete({ gameId: game.id });
      }
      await this.gameRepository.remove(match.games);
    }

    // 새 게임 생성
    const games: Game[] = [];
    let totalOurScore = 0;
    let totalOpponentScore = 0;

    for (const gameDto of recordMatchDto.games) {
      const game = this.gameRepository.create({
        matchId,
        gameNumber: gameDto.gameNumber,
        ourScore: gameDto.ourScore,
        opponentScore: gameDto.opponentScore,
        result: gameDto.result,
      });

      const savedGame = await this.gameRepository.save(game);
      games.push(savedGame);

      totalOurScore += gameDto.ourScore;
      totalOpponentScore += gameDto.opponentScore;
    }

    // 경기 기록 생성
    for (const playerRecord of recordMatchDto.playerRecords) {
      // 각 게임별로 기록 생성
      for (const game of games) {
        const record = this.matchRecordRepository.create({
          matchId,
          gameId: game.id,
          userId: playerRecord.userId,
          played: playerRecord.played,
          goals: playerRecord.goals || 0,
          assists: playerRecord.assists || 0,
          goalType: playerRecord.goalType,
          goalTime: playerRecord.goalTime,
        });

        await this.matchRecordRepository.save(record);
      }
    }

    // 경기 총점 업데이트
    match.totalOurScore = totalOurScore;
    match.totalOpponentScore = totalOpponentScore;
    match.status = MatchStatus.FINISHED;
    if (recordMatchDto.notes) {
      match.notes = recordMatchDto.notes;
    }

    await this.matchRepository.save(match);

    return this.getMatch(matchId);
  }

  async getMatchRecord(matchId: string) {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
      relations: ['games', 'games.records', 'games.records.user'],
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return {
      matchId: match.id,
      games: match.games?.map((game) => ({
        gameId: game.id,
        gameNumber: game.gameNumber,
        ourScore: game.ourScore,
        opponentScore: game.opponentScore,
        result: game.result,
        records: game.records || [],
      })) || [],
      notes: match.notes,
    };
  }

  private async checkTeamPermission(teamId: string, userId: string) {
    const member = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });

    if (!member) {
      throw new ForbiddenException('Not a team member');
    }

    if (
      member.role !== TeamMemberRole.CAPTAIN &&
      member.role !== TeamMemberRole.VICE_CAPTAIN
    ) {
      throw new ForbiddenException(
        'Only captain or vice captain can perform this action',
      );
    }
  }
}

