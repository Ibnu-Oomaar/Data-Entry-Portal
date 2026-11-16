import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class TeacherLoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value))
  @IsString({ message: 'Enter your full name' })
  @IsNotEmpty({ message: 'Enter your full name' })
  @MaxLength(150, { message: 'That name is too long' })
  name: string;

  @IsString({ message: 'Enter your password' })
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @MaxLength(128, { message: 'Password must be no more than 128 characters' })
  password: string;
}

export class StudentLoginDto {
  // Accept 11516 and "11516"; anything else (decimals, letters, arrays) is rejected, not coerced.
  @Transform(({ value }) => (typeof value === 'string' && /^\s*\d+\s*$/.test(value) ? Number(value.trim()) : value))
  @IsInt({ message: 'Student ID must be a whole number' })
  @Min(1, { message: 'Student ID must be a positive number' })
  @Max(2147483647, { message: 'That Student ID is too large' })
  studentId: number;
}
