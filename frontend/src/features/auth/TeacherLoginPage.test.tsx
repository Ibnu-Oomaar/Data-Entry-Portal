import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { TeacherLoginPage } from './TeacherLoginPage';

vi.mock('./AuthProvider', () => ({ useAuth: () => ({ loginTeacherWithPasskey: vi.fn() }) }));
vi.mock('./LoginShell', () => ({
  LoginShell: ({
    title,
    description,
    children,
    footer,
  }: {
    title: string;
    description: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
      {footer}
    </main>
  ),
}));

describe('TeacherLoginPage', () => {
  it('shows only Khalid Harun and does not render a password or account-registration field', () => {
    renderWithProviders(<TeacherLoginPage />, { route: '/login/teacher' });

    expect(screen.getByText('Khalid Harun')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue as Khalid Harun' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/create an account/i)).not.toBeInTheDocument();
  });
});
