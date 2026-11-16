import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../students/student.entity';
import { Teacher } from './teacher.entity';
import { TeacherClassSection } from './teacher-class-section.entity';
import { TeacherClassSectionsService } from './teacher-class-sections.service';
import { TeachersService } from './teachers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Teacher, TeacherClassSection, Student])],
  providers: [TeachersService, TeacherClassSectionsService],
  exports: [TeachersService, TeacherClassSectionsService, TypeOrmModule],
})
export class TeachersModule {}
