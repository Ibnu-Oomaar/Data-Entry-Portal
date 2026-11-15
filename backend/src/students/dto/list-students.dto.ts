import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export const STUDENT_SORT_FIELDS = ['classSection', 'studentId', 'name', 'classLevel', 'section', 'totalMarks', 'status', 'updatedAt'] as const;
export type StudentSortField = (typeof STUDENT_SORT_FIELDS)[number];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

/** Query string for GET /students — filtering, sorting and paging are all done in the database. */
export class ListStudentsDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt({ message: 'classLevel must be a whole number' })
  @Min(1)
  @Max(99)
  classLevel?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() || undefined : value))
  @Matches(/^[A-Z]$/, { message: 'section must be a single letter A–Z' })
  section?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(['pending', 'draft', 'submitted'], { message: 'status must be pending, draft or submitted' })
  status?: 'pending' | 'draft' | 'submitted';

  @IsOptional()
  @Transform((p) => emptyToUndefined({ value: trim(p) }))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(STUDENT_SORT_FIELDS as unknown as string[], { message: `sortBy must be one of ${STUDENT_SORT_FIELDS.join(', ')}` })
  sortBy?: StudentSortField;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(['asc', 'desc'], { message: 'sortDir must be asc or desc' })
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
