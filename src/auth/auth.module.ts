import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../users/entities/user.entity';
import { TeamInvite } from '../teams/entities/team-invite.entity';
import { TeamMember } from '../teams/entities/team-member.entity';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const isProduction = configService.get<string>('NODE_ENV') === 'production';
        const secret = configService.get<string>('JWT_SECRET') || 
          (isProduction ? undefined : 'dev-secret-key-change-in-production');
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN') || '7d';
        
        if (!secret) {
          throw new Error('JWT_SECRET is not defined. Please set JWT_SECRET in your .env file');
        }

        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as any,
          },
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User, TeamInvite, TeamMember]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

