import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  Req,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto);
    
    // Refresh Token을 HttpOnly Cookie로 설정
    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
    });

    // Response에서 refresh_token 제거 (쿠키에만 저장)
    const { refresh_token, ...response } = result;
    return response;
  }

  @Post('signup')
  async signup(@Body() signupDto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signup(signupDto);
    
    // Refresh Token을 HttpOnly Cookie로 설정
    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
    });

    // Response에서 refresh_token 제거 (쿠키에만 저장)
    const { refresh_token, ...response } = result;
    return response;
  }

  @Post('social')
  async socialLogin(@Body() socialLoginDto: SocialLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.socialLogin(socialLoginDto);
    
    // Refresh Token을 HttpOnly Cookie로 설정
    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
    });

    // Response에서 refresh_token 제거 (쿠키에만 저장)
    const { refresh_token, ...response } = result;
    return response;
  }

  @Get('invite/:token')
  async validateInvite(@Param('token') token: string) {
    const invite = await this.authService.validateInviteToken(token);
    return {
      valid: true,
      teamId: invite.teamId,
      teamName: invite.team.name,
    };
  }

  @Post('invite/:token/accept')
  @UseGuards(JwtAuthGuard)
  async acceptInvite(
    @Param('token') token: string,
    @CurrentUser() user: User,
  ) {
    return this.authService.acceptInvite(token, user.id);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.id);
    
    // Refresh Token 쿠키 삭제
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return { success: true, message: 'Logged out successfully' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new Error('Refresh token not found in cookies');
    }

    const result = await this.authService.refreshToken(refreshToken);
    
    // 새 Refresh Token을 쿠키에 설정
    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
    });

    // Response에서 refresh_token 제거 (쿠키에만 저장)
    const { refresh_token, ...response } = result;
    return response;
  }
}

