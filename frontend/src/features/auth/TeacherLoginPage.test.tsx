import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { TeacherLoginPage } from './TeacherLoginPage';

const auth = vi.hoisted(() => ({ loginTeacher: vi.fn() }));
vi.mock('./AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('./LoginShell', () => ({
  LoginShell: ({
    title,
    description,
    children,
  }: {
    title: string;
    description: string;
    children: React.ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </main>
  ),
}));

describe('TeacherLoginPage', () => {
  beforeEach(() => {
    auth.loginTeacher.mockReset();
  });

  it('shows Khalid Harun with a single password input and no name field', () => {
    const { container } = renderWithProviders(<TeacherLoginPage />, { route: '/login/teacher' });

    expect(screen.getByText('Khalid Harun')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(container.querySelectorAll('input')).toHaveLength(1);
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText(/passkey|create an account/i)).not.toBeInTheDocument();
  });

  it('submits only the password through the teacher login action', async () => {
    auth.loginTeacher.mockResolvedValue({
      role: 'teacher',
      user: { fullName: 'Khalid Harun' },
      csrfToken: 'token',
      school: { name: 'School', shift: 'Morning' },
      expiresAt: null,
    });
    renderWithProviders(<TeacherLoginPage />, { route: '/login/teacher' });

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'existing-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(auth.loginTeacher).toHaveBeenCalledWith('existing-password'));
  });
});
