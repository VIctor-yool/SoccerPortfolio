import { IsString, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateMatchDto {
  @IsUUID()
  teamId: string;

  @IsString()
  opponentTeamName: string;

  @IsDateString()
  date: string;

  @IsString()
  @IsOptional()
  time?: string;

  @IsString()
  @IsOptional()
  location?: string;
}

