import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SaveProgress } from '../../src/popup/components/SaveProgress';

describe('SaveProgress', () => {
  it('renders batch progress text', () => {
    render(<SaveProgress status="saving" batchCurrent={2} batchTotal={5} />);

    expect(screen.getByText('Saving 2 of 5...')).toBeTruthy();
  });

  it('renders success state with title', () => {
    render(
      <SaveProgress status="success" savedTitle="Example Page" onDismiss={vi.fn()} />
    );

    expect(screen.getByText('Saved: Example Page')).toBeTruthy();
  });

  it('renders auth error with sign-in action', () => {
    render(
      <SaveProgress
        status="error"
        errorMessage="Auth required"
        errorCode="AUTH_REQUIRED"
        onSignIn={vi.fn()}
      />
    );

    expect(screen.getByText('Please sign in to save items')).toBeTruthy();
    expect(screen.getByText('Sign in')).toBeTruthy();
  });
});
