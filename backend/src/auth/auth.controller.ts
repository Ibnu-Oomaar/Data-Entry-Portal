import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUser } from './auth.types';
import { AuthService } from './auth.service';
import { CurrentUser, Public, Roles } from './decorators/auth.decorators';
import { StudentLoginDto, TeacherLoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('teacher/login')
  @HttpCode(200)
  teacherLogin(@Body() dto: TeacherLoginDto, @Req() req: Request) {
    return this.auth.loginTeacher(req, dto.name);
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
