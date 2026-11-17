import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUser } from './auth.types';
import { AuthService } from './auth.service';
import { CurrentUser, Public, Roles } from './decorators/auth.decorators';
import { StudentLoginDto, TeacherLoginDto } from './dto/login.dto';
import { PasskeyAuthenticationDto, PasskeyRegistrationDto } from './dto/passkey.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('teacher/login')
  @HttpCode(200)
  teacherLogin(@Body() dto: TeacherLoginDto, @Req() req: Request) {
    return this.auth.loginTeacher(req, dto.name, dto.password);
  }

  @Public()
  @Post('teacher/passkey/options')
  @HttpCode(200)
  teacherPasskeyOptions(@Req() req: Request) {
    return this.auth.passkeyLoginOptions(req);
  }

  @Public()
  @Post('teacher/passkey/verify')
  @HttpCode(200)
  teacherPasskeyVerify(@Body() dto: PasskeyAuthenticationDto, @Req() req: Request) {
    return this.auth.loginTeacherWithPasskey(req, dto.flowId, dto.response);
  }

  @Post('teacher/passkey/register/options')
  @HttpCode(200)
  @Roles('teacher')
  teacherPasskeyRegistrationOptions(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.auth.passkeyRegistrationOptions(req, user);
  }

  @Post('teacher/passkey/register/verify')
  @HttpCode(200)
  @Roles('teacher')
  teacherPasskeyRegistrationVerify(
    @CurrentUser() user: AuthUser,
    @Body() dto: PasskeyRegistrationDto,
    @Req() req: Request,
  ) {
    return this.auth.registerPasskey(req, user, dto.flowId, dto.response);
  }

  @Get('teacher/passkeys')
  @Roles('teacher')
  teacherPasskeys(@CurrentUser() user: AuthUser) {
    return this.auth.listPasskeys(user);
  }

  @Public()
  @Post('student/login')
  @HttpCode(200)
  studentLogin(@Body() dto: StudentLoginDto, @Req() req: Request) {
    return this.auth.loginStudent(req, dto.studentId);
  }

  @Post('logout')
  @HttpCode(200)
  @Roles('teacher', 'student')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req, res);
    return { loggedOut: true };
  }

  /** Who am I? Also re-delivers the CSRF token to a freshly loaded page. */
  @Get('me')
  @Roles('teacher', 'student')
  me(@Req() req: Request, @CurrentUser() user: AuthUser) {
    return this.auth.view(req, user);
  }
}
