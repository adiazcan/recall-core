import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SignOutButton } from './SignOutButton';

const signOut = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ signOut }),
}));

describe('SignOutButton', () => {
  it('calls sign-out on click', () => {
    render(<SignOutButton />);

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
