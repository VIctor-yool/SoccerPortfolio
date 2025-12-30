import { IsUUID, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { TeamMemberStatus } from '../entities/team-member.entity';

export class AddMemberDto {
  @IsUUID()
  userId: string;

  @IsNumber()
  @IsOptional()
  jerseyNumber?: number;

  @IsEnum(TeamMemberStatus)
  @IsOptional()
  status?: TeamMemberStatus;
}

