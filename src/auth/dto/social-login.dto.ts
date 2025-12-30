import { IsEnum, IsString } from 'class-validator';
import { Provider } from '../../users/entities/user.entity';

export class SocialLoginDto {
  @IsEnum(Provider)
  provider: Provider;

  @IsString()
  providerId: string;

  @IsString()
  email: string;

  @IsString()
  name: string;

  @IsString()
  profileImage?: string;
}

