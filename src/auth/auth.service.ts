import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, Provider } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { TeamInvite } from '../teams/entities/team-invite.entity';
import { TeamMember, TeamMemberRole } from '../teams/entities/team-member.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(TeamInvite)
    private teamInviteRepository: Repository<TeamInvite>,
    @InjectRepository(TeamMember)
    private teamMemberRepository: Repository<TeamMember>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

  async signup(signupDto: SignupDto) {
    const existingUser = await this.userRepository.findOne({
      where: { email: signupDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(signupDto.password, 10);
    
    // 기본 프로필 이미지 URL 가져오기
    const defaultProfileImage = this.configService.get<string>('PROFILE_DEFAULT_IMAGE');

    const user = this.userRepository.create({
      email: signupDto.email,
      password: hashedPassword,
      name: signupDto.name,
      provider: Provider.EMAIL,
      profileImage: defaultProfileImage || undefined,
    });

    const savedUser = await this.userRepository.save(user);
    return this.generateToken(savedUser);
  }

  async socialLogin(socialLoginDto: SocialLoginDto) {
    let user = await this.userRepository.findOne({
      where: {
        provider: socialLoginDto.provider,
        providerId: socialLoginDto.providerId,
      },
    });

    if (!user) {
      // 이메일로 기존 사용자 확인
      const existingUser = await this.userRepository.findOne({
        where: { email: socialLoginDto.email },
      });

      if (existingUser) {
        // 기존 사용자에 소셜 정보 추가
        existingUser.provider = socialLoginDto.provider;
        existingUser.providerId = socialLoginDto.providerId;
        if (socialLoginDto.profileImage) {
          existingUser.profileImage = socialLoginDto.profileImage;
        }
        user = await this.userRepository.save(existingUser);
      } else {
        // 새 사용자 생성
        // 기본 프로필 이미지 URL 가져오기
        const defaultProfileImage = this.configService.get<string>('PROFILE_DEFAULT_IMAGE');
        
        user = this.userRepository.create({
          email: socialLoginDto.email,
          name: socialLoginDto.name,
          provider: socialLoginDto.provider,
          providerId: socialLoginDto.providerId,
          profileImage: socialLoginDto.profileImage || defaultProfileImage || undefined,
        });
        user = await this.userRepository.save(user);
      }
    }

    return this.generateToken(user);
  }

  async validateInviteToken(token: string) {
    const invite = await this.teamInviteRepository.findOne({
      where: { token },
      relations: ['team'],
    });

    if (!invite) {
      throw new NotFoundException('Invalid invite token');
    }

    if (invite.used) {
      throw new ConflictException('Invite token already used');
    }

    if (new Date() > invite.expiresAt) {
      throw new ConflictException('Invite token expired');
    }

    return invite;
  }

  async acceptInvite(token: string, userId: string) {
    const invite = await this.validateInviteToken(token);

    // 이미 팀원인지 확인
    const existingMember = await this.teamMemberRepository.findOne({
      where: {
        teamId: invite.teamId,
        userId,
      },
    });

    if (existingMember) {
      throw new ConflictException('User is already a team member');
    }

    // 팀원으로 추가
    const teamMember = this.teamMemberRepository.create({
      teamId: invite.teamId,
      userId,
      role: TeamMemberRole.MEMBER,
    });

    await this.teamMemberRepository.save(teamMember);

    // 초대 토큰 사용 처리
    invite.used = true;
    await this.teamInviteRepository.save(invite);

    return { success: true, teamId: invite.teamId };
  }

  async logout(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Refresh 토큰 삭제
    user.refreshToken = undefined;
    await this.userRepository.save(user);

    return { success: true, message: 'Logged out successfully' };
  }

  async refreshToken(refreshToken: string) {
    try {
      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        this.configService.get<string>('JWT_SECRET');

      // Refresh 토큰 검증
      const payload = this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // 새 토큰 생성
      return this.generateToken(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateToken(user: User) {
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      this.configService.get<string>('JWT_SECRET');

    // Refresh 토큰 생성 (더 긴 만료 시간)
    const refreshPayload = { sub: user.id, type: 'refresh' };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: '30d',
      secret: refreshSecret,
    });

    // Refresh 토큰을 DB에 저장
    user.refreshToken = refreshToken;
    await this.userRepository.save(user);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }
}

