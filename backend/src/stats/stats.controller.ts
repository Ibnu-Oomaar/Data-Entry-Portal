import { Controller, Get } from '@nestjs/common';
import type { TeacherUser } from '../auth/auth.types';
import { CurrentTeacher, Roles } from '../auth/decorators/auth.decorators';
import { StatsService } from './stats.service';

@Controller('stats')
@Roles('teacher')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  overview(@CurrentTeacher() teacher: TeacherUser) {
    return this.stats.overview(teacher.id);
  }

  @Get('me')
  me(@CurrentTeacher() teacher: TeacherUser) {
    return this.stats.teacherActivity(teacher.id);
  }
}
