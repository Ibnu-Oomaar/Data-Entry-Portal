
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { StudentsModule } from '../students/students.module';
import { TeachersModule } from '../teachers/teachers.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfGuard, RateLimitGuard, RolesGuard, SessionAuthGuard } from './guards/auth.guards';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [TeachersModule, StudentsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    RateLimitService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AuthModule {}
