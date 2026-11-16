import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeachersModule } from '../teachers/teachers.module';
import { Student } from './student.entity';
import { StudentImportService } from './import/student-import.service';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [TypeOrmModule.forFeature([Student]), TeachersModule],
  controllers: [StudentsController],
  providers: [StudentsService, StudentImportService],
  exports: [StudentsService, StudentImportService, TypeOrmModule],
})
export class StudentsModule {}
