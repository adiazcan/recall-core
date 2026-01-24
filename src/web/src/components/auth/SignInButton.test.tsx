import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SignInButton } from './SignInButton';

const signIn = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ signIn }),
}));

describe('SignInButton', () => {
  it('calls sign-in on click', () => {
    render(<SignInButton />);

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(signIn).toHaveBeenCalledTimes(1);
  });
});
