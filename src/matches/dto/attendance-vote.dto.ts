import { IsEnum } from 'class-validator';
import { AttendanceStatus } from '../entities/match-attendance.entity';

export class AttendanceVoteDto {
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;
}

