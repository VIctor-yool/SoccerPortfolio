import {
  IsArray,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GoalType } from '../entities/match-record.entity';
import { CreateGameDto } from './create-game.dto';

export class PlayerRecordDto {
  @IsUUID()
  userId: string;

  @IsBoolean()
  played: boolean;

  @IsNumber()
  @IsOptional()
  goals?: number;

  @IsNumber()
  @IsOptional()
  assists?: number;

  @IsEnum(GoalType)
  @IsOptional()
  goalType?: GoalType;

  @IsNumber()
  @IsOptional()
  goalTime?: number;
}

export class RecordMatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGameDto)
  games: CreateGameDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayerRecordDto)
  playerRecords: PlayerRecordDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

