import { IsNumber, IsEnum, IsUUID } from 'class-validator';
import { GameResult } from '../entities/game.entity';

export class CreateGameDto {
  @IsNumber()
  gameNumber: number;

  @IsNumber()
  ourScore: number;

  @IsNumber()
  opponentScore: number;

  @IsEnum(GameResult)
  result: GameResult;
}

