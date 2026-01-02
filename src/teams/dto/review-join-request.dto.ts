import { IsEnum } from 'class-validator';
import { JoinRequestStatus } from '../entities/team-join-request.entity';

export class ReviewJoinRequestDto {
  @IsEnum(JoinRequestStatus)
  status: JoinRequestStatus;
}

