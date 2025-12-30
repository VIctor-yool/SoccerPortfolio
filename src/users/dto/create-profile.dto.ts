import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  IsEnum,
  Matches,
} from 'class-validator';
import { Position } from '../entities/user-position.entity';

export class CreateProfileDto {
  @IsString()
  name: string;

  @IsDateString()
  @IsOptional()
  birthdate?: string;

  @IsString()
  @IsOptional()
  @Matches(/^010-\d{4}-\d{4}$/, {
    message: 'Phone number must be in format 010-XXXX-XXXX',
  })
  phone?: string;

  @IsArray()
  @IsEnum(Position, { each: true })
  positions: Position[];

  @IsString()
  @IsOptional()
  summary?: string;
}

