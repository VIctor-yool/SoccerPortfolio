import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Match, MatchStatus } from '../matches/entities/match.entity';
import { MatchAttendance, AttendanceStatus } from '../matches/entities/match-attendance.entity';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(MatchAttendance)
    private matchAttendanceRepository: Repository<MatchAttendance>,
  ) {}

  async getSummary(teamId: string) {
    const scheduledMatches = await this.matchRepository.find({
      where: {
        teamId,
        status: MatchStatus.SCHEDULED,
      },
    });

    if (scheduledMatches.length === 0) {
      return {
        attending: 0,
        late: 0,
        absent: 0,
      };
    }

    const matchIds = scheduledMatches.map((m) => m.id);

    const attendances = await this.matchAttendanceRepository.find({
      where: {
        matchId: In(matchIds),
      },
    });

    const attending = attendances.filter(
      (a) => a.status === AttendanceStatus.ATTENDING,
    ).length;
    const late = attendances.filter(
      (a) => a.status === AttendanceStatus.LATE,
    ).length;
    const absent = attendances.filter(
      (a) => a.status === AttendanceStatus.ABSENT ||
        a.status === AttendanceStatus.NOT_ATTENDING,
    ).length;

    return {
      attending,
      late,
      absent,
    };
  }
}

