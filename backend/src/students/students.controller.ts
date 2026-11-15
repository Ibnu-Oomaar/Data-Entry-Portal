import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/auth.decorators';
import { ListStudentsDto } from './dto/list-students.dto';
import { StudentsService } from './students.service';

/** Teacher-only. Students can only read their own record through /me/assessment. */
@Controller('students')
@Roles('teacher')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list(@Query() query: ListStudentsDto) {
    return this.students.list(query);
  }

  @Get('structure')
  structure() {
    return this.students.structure();
  }
}
