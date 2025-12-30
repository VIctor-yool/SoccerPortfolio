import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    const isProduction = configService.get<string>('NODE_ENV') === 'production';
    const secret = configService.get<string>('JWT_SECRET') || 
      (isProduction ? undefined : 'dev-secret-key-change-in-production');
    
    if (!secret) {
      const errorMessage = isProduction
        ? 'JWT_SECRET is required in production. Please set JWT_SECRET environment variable in your deployment platform (e.g., Render dashboard).'
        : 'JWT_SECRET is not defined. Please set JWT_SECRET in your .env file';
      throw new Error(errorMessage);
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}

