import { Body, Controller, Get, HttpStatus, Param, ParseIntPipe, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentStudent, CurrentTeacher, Roles } from '../auth/decorators/auth.decorators';
import type { StudentUser, TeacherUser } from '../auth/auth.types';
import { AppException } from '../common/errors/app.exception';
import { ListStudentsDto } from '../students/dto/list-students.dto';
import { AssessmentsService } from './assessments.service';
import { SaveAssessmentDto } from './dto/save-assessment.dto';

const studentIdPipe = new ParseIntPipe({
  exceptionFactory: () => new AppException(HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR', 'Student ID must be a whole number.'),
});

/** Teachers enter and review marks. */
@Controller('assessments')
@Roles('teacher')
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get()
  list(@Query() query: ListStudentsDto, @CurrentTeacher() teacher: TeacherUser) {
    return this.assessments.list(query, teacher.id);
  }

  @Get('student/:studentId')
  get(
    @Param('studentId', studentIdPipe) studentId: number,
    @Query() query: ListStudentsDto,
    @CurrentTeacher() teacher: TeacherUser,
  ) {
    return this.assessments.getForTeacher(studentId, teacher.id, query.classLevel, query.section);
  }

  @Get('export')
  async export(@Query() query: ListStudentsDto, @CurrentTeacher() teacher: TeacherUser, @Res() response: Response): Promise<void> {
    const workbook = await this.assessments.export(query, teacher.id);
    response
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attachment(this.assessments.exportFilename(query))
      .send(workbook);
  }

  /** Create-or-update. Idempotent for identical payloads; guarded by expectedVersion. */
  @Put('student/:studentId')
  save(
    @Param('studentId', studentIdPipe) studentId: number,
    @Body() dto: SaveAssessmentDto,
    @Query() query: ListStudentsDto,
    @CurrentTeacher() teacher: TeacherUser,
  ) {
    return this.assessments.save(studentId, dto, teacher.id, query.classLevel, query.section);
  }
}

/** Students can only read their own record. There is no endpoint that accepts a student id for students. */
@Controller('me')
@Roles('student')
export class MeController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get('assessment')
  own(@CurrentStudent() student: StudentUser) {
    return this.assessments.getOwn(student.id);
  }
}
