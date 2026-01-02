import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateJoinRequestDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  message?: string;
}

