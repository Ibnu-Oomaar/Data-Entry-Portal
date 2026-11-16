import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { TeacherUser } from '../auth/auth.types';
import { CurrentTeacher, Roles } from '../auth/decorators/auth.decorators';
import { ListStudentsDto } from './dto/list-students.dto';
import { StudentsService } from './students.service';

/** Teacher-only. Students can only read their own record through /me/assessment. */
@Controller('students')
@Roles('teacher')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list(@Query() query: ListStudentsDto, @CurrentTeacher() teacher: TeacherUser) {
    return this.students.list(query, teacher.id);
  }

  @Get('structure')
  structure(@CurrentTeacher() teacher: TeacherUser) {
    return this.students.structure(teacher.id);
  }

  @Get('export')
  async export(@Query() query: ListStudentsDto, @CurrentTeacher() teacher: TeacherUser, @Res() response: Response): Promise<void> {
    const workbook = await this.students.export(query, teacher.id);
    response
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attachment(this.students.exportFilename(query))
      .send(workbook);
  }
}
