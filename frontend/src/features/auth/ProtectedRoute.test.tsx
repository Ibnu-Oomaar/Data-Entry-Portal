import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { Session } from '@/types/api';
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute';

const auth = vi.hoisted(() => ({ value: { status: 'anonymous', session: null, signedOut: false } as { status: string; session: Session | null; signedOut: boolean } }));
vi.mock('./AuthProvider', () => ({ useAuth: () => auth.value }));

const school = { name: 'Noradin Boys Secondary School', shift: 'Morning' };
const teacher: Session = { role: 'teacher', user: { fullName: 'Demo Teacher' }, csrfToken: 't', school, expiresAt: null };
const student: Session = { role: 'student', user: { studentId: 9299, name: 'A B', classLevel: 3, section: 'C' }, csrfToken: 't', school, expiresAt: null };

function tree() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/" element={<p>landing</p>} />
        <Route path="/login/teacher" element={<p>teacher login</p>} />
        <Route path="/login/student" element={<p>student login</p>} />
      </Route>
      <Route path="/teacher" element={<ProtectedRoute role="teacher" />}>
        <Route index element={<p>teacher area</p>} />
      </Route>
      <Route path="/student" element={<ProtectedRoute role="student" />}>
        <Route index element={<p>student area</p>} />
      </Route>
    </Routes>
  );
}

beforeEach(() => {
  auth.value = { status: 'anonymous', session: null, signedOut: false };
});

describe('route guards', () => {
  it('sends anonymous visitors to the matching login page', () => {
    renderWithProviders(tree(), { route: '/teacher' });
    expect(screen.getByText('teacher login')).toBeInTheDocument();
  });
  it('after pressing Sign out, goes to the start page instead of a login page', () => {
    auth.value = { status: 'anonymous', session: null, signedOut: true };
    renderWithProviders(tree(), { route: '/teacher' });
    expect(screen.getByText('landing')).toBeInTheDocument();
  });
  it('sends anonymous student-area visitors to the student login', () => {
    renderWithProviders(tree(), { route: '/student' });
    expect(screen.getByText('student login')).toBeInTheDocument();
  });
  it('shows a loading state while the session is being checked (no flash of login)', () => {
    auth.value = { status: 'loading', session: null, signedOut: false };
    renderWithProviders(tree(), { route: '/teacher' });
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('teacher login')).not.toBeInTheDocument();
  });
  it('lets a teacher into the teacher area', () => {
    auth.value = { status: 'authenticated', session: teacher, signedOut: false };
    renderWithProviders(tree(), { route: '/teacher' });
    expect(screen.getByText('teacher area')).toBeInTheDocument();
  });
  it('keeps a student out of the teacher area and sends them home', () => {
    auth.value = { status: 'authenticated', session: student, signedOut: false };
    renderWithProviders(tree(), { route: '/teacher' });
    expect(screen.queryByText('teacher area')).not.toBeInTheDocument();
    expect(screen.getByText('student area')).toBeInTheDocument();
  });
  it('keeps a teacher out of the student area', () => {
    auth.value = { status: 'authenticated', session: teacher, signedOut: false };
    renderWithProviders(tree(), { route: '/student' });
    expect(screen.getByText('teacher area')).toBeInTheDocument();
  });
  it('bounces signed-in people off the login pages', () => {
    auth.value = { status: 'authenticated', session: teacher, signedOut: false };
    renderWithProviders(tree(), { route: '/login/teacher' });
    expect(screen.getByText('teacher area')).toBeInTheDocument();
  });
});
