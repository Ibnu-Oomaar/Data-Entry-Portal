import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { StudentFilters } from '@/hooks/useStudentFilters';
import { renderWithProviders } from '@/test/render';
import type { ClassSummary } from '@/types/api';
import { StudentFilterBar } from './StudentFilterBar';

const structure: ClassSummary[] = [
  {
    classLevel: 1,
    students: 10,
    completed: 0,
    inProgress: 0,
    notStarted: 10,
    average: null,
    sections: [
      { section: 'B', students: 6, completed: 0, inProgress: 0, notStarted: 6, average: null },
      { section: 'C', students: 4, completed: 0, inProgress: 0, notStarted: 4, average: null },
    ],
  },
  {
    classLevel: 3,
    students: 5,
    completed: 0,
    inProgress: 0,
    notStarted: 5,
    average: null,
    sections: [{ section: 'A', students: 5, completed: 0, inProgress: 0, notStarted: 5, average: null }],
  },
];

const initial: StudentFilters = {
  search: '',
  sortBy: 'classSection',
  sortDir: 'asc',
  page: 1,
  pageSize: 50,
};

function FilterHarness() {
  const [filters, setFilters] = useState(initial);
  return (
    <StudentFilterBar
      filters={filters}
      update={(patch) => setFilters((current) => ({ ...current, ...patch }))}
      reset={() => setFilters(initial)}
      isFiltered={!!(filters.classLevel || filters.section)}
      structure={structure}
      sortFields={['classSection']}
    />
  );
}

describe('StudentFilterBar class and section controls', () => {
  it('updates available sections when the selected class changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FilterHarness />);

    await user.click(screen.getByRole('combobox', { name: 'Class Select' }));
    await user.click(await screen.findByRole('option', { name: 'Class 1' }));
    const section = screen.getByRole('combobox', { name: 'Section Select' });
    expect(section).toBeEnabled();

    await user.click(section);
    expect(await screen.findByRole('option', { name: 'Section B (6)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Section C (4)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Section A (5)' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Section B (6)' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Section Select' })).toHaveTextContent('Section B'));

    await user.click(screen.getByRole('combobox', { name: 'Class Select' }));
    await user.click(await screen.findByRole('option', { name: 'Class 3' }));
    await user.click(screen.getByRole('combobox', { name: 'Section Select' }));
    expect(await screen.findByRole('option', { name: 'Section A (5)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Section B (6)' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'All sections' }));
    expect(screen.getByRole('combobox', { name: 'Section Select' })).toHaveTextContent('All sections');
  });
});
