import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/services/api-client';
import { renderWithProviders } from '@/test/render';
import type { StudentAssessment } from '@/types/api';
import { MarkSheet } from './MarkSheet';

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('@/services/api', () => ({ assessmentsApi: { get: api.get, save: api.save } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));

const student = { studentId: 9299, name: 'Abdalle Ali Abdillahi Abdi', classLevel: 3, section: 'C' };
const empty: StudentAssessment = { student, assessment: null };

const saved = (over: Partial<NonNullable<StudentAssessment['assessment']>> = {}): StudentAssessment => ({
  student,
  assessment: {
    marks: { chapter1Notes: 2, chapter1Exercises: 5, chapter1Assignment: 4, chapter2Notes: null, chapter2Exercises: null, chapter2Assignment: null, textbook: null },
    subtotals: { chapter1: 11, chapter2: 0, textbook: 0 },
    totalMarks: 11,
    maxTotal: 30,
    remaining: 19,
    enteredCount: 3,
    status: 'draft',
    version: 3,
    createdAt: '2026-11-15T10:00:00Z',
    updatedAt: '2026-11-15T10:00:00Z',
    createdBy: 'Demo Teacher',
    updatedBy: 'Demo Teacher',
    ...over,
  },
});

const setup = (data: StudentAssessment, props: Partial<React.ComponentProps<typeof MarkSheet>> = {}) => {
  api.get.mockResolvedValue(data);
  const onNext = vi.fn();
  const onClose = vi.fn();
  const onDirtyChange = vi.fn();
  const utils = renderWithProviders(<MarkSheet studentId={9299} onNext={onNext} onClose={onClose} onDirtyChange={onDirtyChange} hasNext {...props} />);
  return { ...utils, onNext, onClose, onDirtyChange, user: userEvent.setup() };
};

const input = (label: string) => screen.getByRole('textbox', { name: label }) as HTMLInputElement;
const waitForForm = () => screen.findByRole('form', { name: /Marks for Abdalle/ });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MarkSheet', () => {
  it('shows the seven labelled inputs with their maximums', async () => {
    setup(empty);
    await waitForForm();
    const parts: Array<[string, number]> = [
      ['Chapter 1 Notes', 2],
      ['Chapter 1 Exercises', 6],
      ['Chapter 1 Assignment', 5],
      ['Chapter 2 Notes', 2],
      ['Chapter 2 Exercises', 6],
      ['Chapter 2 Assignment', 5],
      ['Textbook', 4],
    ];
    for (const [label, max] of parts) {
      const row = input(label).parentElement!;
      expect(row.textContent?.replace(/\s/g, '')).toContain(`/${max}`);
    }
    expect(screen.getByText('30 marks remaining')).toBeInTheDocument();
  });

  it('updates subtotals, total and remaining marks as the teacher types', async () => {
    const { user } = setup(empty);
    await waitForForm();
    await user.type(input('Chapter 1 Notes'), '2');
    await user.type(input('Chapter 1 Exercises'), '5.5');
    await user.type(input('Textbook'), '3');
    expect(screen.getByText('19.5 marks remaining')).toBeInTheDocument();
    expect(screen.getByText('3 of 7 parts entered')).toBeInTheDocument();
  });

  it('flags negative, over-maximum and non-numeric values and blocks saving', async () => {
    const { user } = setup(empty);
    await waitForForm();
    await user.type(input('Chapter 1 Notes'), '3');
    await user.type(input('Chapter 1 Exercises'), '-1');
    await user.type(input('Chapter 1 Assignment'), 'abc');
    expect(await screen.findByText('Chapter 1 Notes cannot be more than 2')).toBeInTheDocument();
    expect(screen.getByText('Chapter 1 Exercises cannot be negative')).toBeInTheDocument();
    expect(screen.getByText('Chapter 1 Assignment must be a number')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save & next/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Save & next/ }));
    expect(api.save).not.toHaveBeenCalled();
  });

  it('refuses to save an empty sheet', async () => {
    const { user } = setup(empty);
    await waitForForm();
    await user.click(screen.getByRole('button', { name: /Save & next/ }));
    expect(await screen.findByText('Enter at least one mark before saving.')).toBeInTheDocument();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('saves only the marks, never a client-side total, and carries the version for conflict detection', async () => {
    api.save.mockResolvedValue({ ...saved({ version: 4 }), created: false, unchanged: false });
    const { user, onNext } = setup(saved());
    await waitForForm();
    await user.clear(input('Chapter 2 Notes'));
    await user.type(input('Chapter 2 Notes'), '1,5');
    await user.click(screen.getByRole('button', { name: /Save & next/ }));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    const [id, payload] = api.save.mock.calls[0];
    expect(id).toBe(9299);
    expect(payload).toEqual({
      chapter1Notes: 2,
      chapter1Exercises: 5,
      chapter1Assignment: 4,
      chapter2Notes: 1.5,
      chapter2Exercises: null,
      chapter2Assignment: null,
      textbook: null,
      expectedVersion: 3,
    });
    expect(payload).not.toHaveProperty('totalMarks');
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
  });

  it('does not send the same save twice when the button is pressed repeatedly', async () => {
    let resolve!: (v: unknown) => void;
    api.save.mockReturnValue(new Promise((r) => (resolve = r)));
    const { user } = setup(empty);
    await waitForForm();
    await user.type(input('Textbook'), '4');
    const save = screen.getByRole('button', { name: 'Save' });
    await user.click(save);
    expect(await screen.findByRole('button', { name: /Saving/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Save & next/ }));
    expect(api.save).toHaveBeenCalledTimes(1);
    resolve({ ...saved(), created: true, unchanged: false });
  });

  it('keeps what was typed and explains when someone else changed the record (409)', async () => {
    api.save.mockRejectedValue(new ApiError(409, 'STALE_ASSESSMENT', 'These marks were changed by another teacher while you were editing.'));
    const { user } = setup(saved());
    await waitForForm();
    await user.clear(input('Textbook'));
    await user.type(input('Textbook'), '2');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/changed by another teacher/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show latest marks/ })).toBeInTheDocument();
    expect(input('Textbook').value).toBe('2');
  });

  it('shows server-side field errors next to the right input', async () => {
    api.save.mockRejectedValue(new ApiError(422, 'VALIDATION_ERROR', 'Invalid marks', { textbook: 'Textbook cannot be more than 4' }));
    const { user } = setup(saved());
    await waitForForm();
    await user.type(input('Textbook'), '4');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Textbook cannot be more than 4')).toBeInTheDocument();
  });

  it('reports unsaved changes to the page, and Cancel brings the saved marks back', async () => {
    const { user, onDirtyChange } = setup(saved());
    await waitForForm();
    await user.clear(input('Chapter 1 Notes'));
    await user.type(input('Chapter 1 Notes'), '1');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(input('Chapter 1 Notes').value).toBe('2'));
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it('"Save & next" on an unchanged, already-saved student just moves on without calling the API', async () => {
    const { user, onNext } = setup(saved());
    await waitForForm();
    await user.click(screen.getByRole('button', { name: /Save & next/ }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(api.save).not.toHaveBeenCalled();
  });

  it('loads a failure state with a retry instead of a blank screen', async () => {
    api.get.mockRejectedValue(new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.'));
    renderWithProviders(<MarkSheet studentId={9299} onNext={vi.fn()} onClose={vi.fn()} onDirtyChange={vi.fn()} hasNext />);
    expect(await screen.findByText(/Cannot reach the server/)).toBeInTheDocument();
    expect(within(document.body).getByRole('button', { name: /try again|retry/i })).toBeInTheDocument();
  });
});
