import { applyDecorators } from '@nestjs/common';
import { IsInt, IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { ASSESSMENT_COMPONENTS, MARK_DECIMALS } from '../../common/constants/assessment';

const maxOf = (key: string) => ASSESSMENT_COMPONENTS.find((c) => c.key === key)!.max;
const labelOf = (key: string) => ASSESSMENT_COMPONENTS.find((c) => c.key === key)!.label;

/**
 * One mark: a number in [0, max] with at most 2 decimals, or null ("not entered yet").
 * A missing key is an error — a partial payload must never silently erase data.
 */
function MarkField(key: string) {
  const label = labelOf(key);
  const max = maxOf(key);
  return applyDecorators(
    ValidateIf((_o, v) => v !== null),
    IsNumber(
      { allowNaN: false, allowInfinity: false, maxDecimalPlaces: MARK_DECIMALS },
      {
        message: (args) =>
          args.value === undefined
            ? `${label} is required — send null if it has not been entered yet`
            : `${label} must be a number with at most ${MARK_DECIMALS} decimal places (or empty)`,
      },
    ),
    Min(0, { message: `${label} cannot be negative` }),
    Max(max, { message: `${label} cannot be more than ${max}` }),
  );
}

export class SaveAssessmentDto {
  @MarkField('chapter1Notes') chapter1Notes: number | null;
  @MarkField('chapter1Exercises') chapter1Exercises: number | null;
  @MarkField('chapter1Assignment') chapter1Assignment: number | null;
  @MarkField('chapter2Notes') chapter2Notes: number | null;
  @MarkField('chapter2Exercises') chapter2Exercises: number | null;
  @MarkField('chapter2Assignment') chapter2Assignment: number | null;
  @MarkField('textbook') textbook: number | null;

  /**
   * The version the teacher's form was loaded with. Omit/null when creating the first record.
   * Prevents one teacher silently overwriting another teacher's newer save.
   */
  @IsOptional()
  @IsInt({ message: 'expectedVersion must be a whole number' })
  @Min(1)
  expectedVersion?: number | null;
}
