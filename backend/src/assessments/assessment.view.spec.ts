import { Assessment } from './assessment.entity';
import { toAssessmentView } from './assessment.view';

describe('toAssessmentView', () => {
  it('uses the stored audit names when a teacher account has been removed', () => {
    const assessment = Object.assign(new Assessment(), {
      chapter1Notes: null,
      chapter1Exercises: null,
      chapter1Assignment: null,
      chapter2Notes: null,
      chapter2Exercises: null,
      chapter2Assignment: null,
      textbook: null,
      status: 'draft',
      version: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      createdByName: 'Mohamed Yusuf',
      updatedByName: 'Mohamed Yusuf',
    });

    expect(toAssessmentView(assessment, { audit: true })).toMatchObject({
      createdBy: 'Mohamed Yusuf',
      updatedBy: 'Mohamed Yusuf',
    });
  });
});
