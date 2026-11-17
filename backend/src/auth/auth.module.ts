import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsModule } from '../students/students.module';
import { TeacherPasskey } from '../teachers/teacher-passkey.entity';
import { TeachersModule } from '../teachers/teachers.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfGuard, RateLimitGuard, RolesGuard, SessionAuthGuard } from './guards/auth.guards';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [TypeOrmModule.forFeature([TeacherPasskey]), TeachersModule, StudentsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    RateLimitService,
    // Global guards run in this order for every route.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AuthModule {}
