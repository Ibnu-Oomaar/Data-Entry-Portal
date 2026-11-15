import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AssessmentsModule } from './assessments/assessments.module';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { StatsModule } from './stats/stats.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    TeachersModule,
    StudentsModule,
    AssessmentsModule,
    StatsModule,
    AuthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
