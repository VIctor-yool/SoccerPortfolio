import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { Match } from '../matches/entities/match.entity';
import { MatchAttendance } from '../matches/entities/match-attendance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Match, MatchAttendance])],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}

