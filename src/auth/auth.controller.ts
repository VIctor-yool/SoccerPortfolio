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

  // 쿠키 옵션 헬퍼 함수
  private getCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    const corsOrigin = process.env.CORS_ORIGIN || '';
    // 프로덕션 환경에서는 항상 크로스 사이트 요청으로 간주
    const isCrossOrigin = isProduction || corsOrigin.startsWith('https://');
    
    return {
      httpOnly: true,
      secure: isCrossOrigin, // HTTPS면 secure 사용
      sameSite: isCrossOrigin ? ('none' as const) : ('lax' as const), // 크로스 사이트면 'none'
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto);
    
    // Refresh Token을 HttpOnly Cookie로 설정
    res.cookie('refreshToken', result.refresh_token, this.getCookieOptions());

    // Response에서 refresh_token 제거 (쿠키에만 저장)
    const { refresh_token, ...response } = result;
    return response;
  }

  @Post('signup')
  async signup(@Body() signupDto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signup(signupDto);
    
    // Refresh Token을 HttpOnly Cookie로 설정
    res.cookie('refreshToken', result.refresh_token, this.getCookieOptions());

    // Response에서 refresh_token 제거 (쿠키에만 저장)
    const { refresh_token, ...response } = result;
    return response;
  }

  @Post('social')
  async socialLogin(@Body() socialLoginDto: SocialLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.socialLogin(socialLoginDto);
    
    // Refresh Token을 HttpOnly Cookie로 설정
    res.cookie('refreshToken', result.refresh_token, this.getCookieOptions());

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
    
    // Refresh Token 쿠키 삭제 (clearCookie는 쿠키 설정과 동일한 옵션 필요)
    const cookieOptions = this.getCookieOptions();
    res.clearCookie('refreshToken', {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
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
    res.cookie('refreshToken', result.refresh_token, this.getCookieOptions());

    // Response에서 refresh_token 제거 (쿠키에만 저장)
    const { refresh_token, ...response } = result;
    return response;
  }
}

