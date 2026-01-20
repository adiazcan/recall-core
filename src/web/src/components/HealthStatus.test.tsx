import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HealthStatus } from './HealthStatus';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HealthStatus', () => {
  it('renders operational status when API responds ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      }),
    );

    render(<HealthStatus />);

    expect(screen.getByText('Checking')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Operational')).toBeInTheDocument();
    });

    expect(screen.getByText('API responded with status: ok')).toBeInTheDocument();
  });

  it('renders error when API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    render(<HealthStatus />);

    await waitFor(() => {
      expect(screen.getByText('Unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error')).toBeInTheDocument();
  });
});
