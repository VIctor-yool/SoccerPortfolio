import { IsOptional, IsNumber, IsEnum } from 'class-validator';
import { TeamMemberRole, TeamMemberStatus } from '../entities/team-member.entity';

export class UpdateMemberDto {
  @IsNumber()
  @IsOptional()
  jerseyNumber?: number;

  @IsEnum(TeamMemberRole)
  @IsOptional()
  role?: TeamMemberRole;

  @IsEnum(TeamMemberStatus)
  @IsOptional()
  status?: TeamMemberStatus;
}

