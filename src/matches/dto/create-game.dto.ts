import { IsNumber, IsEnum, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { GameResult } from '../entities/game.entity';
import { PlayerRecordDto } from './record-match.dto';

export class CreateGameDto {
  @IsNumber()
  gameNumber: number;

  @IsNumber()
  ourScore: number;

  @IsNumber()
  opponentScore: number;

  @IsEnum(GameResult)
  @IsOptional()
  result?: GameResult;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlayerRecordDto)
  @IsOptional()
  playerRecords?: PlayerRecordDto[];
}

