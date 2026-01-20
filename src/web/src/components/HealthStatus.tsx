import { useEffect, useState } from 'react';

type HealthState = { status: 'loading' } | { status: 'ok' } | { status: 'error'; message: string };

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5080';

export function HealthStatus() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });

  useEffect(() => {
    let isActive = true;

    async function loadHealth() {
      try {
        const response = await fetch(`${apiBaseUrl}/health`, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Health check failed (${response.status})`);
        }

        const body = (await response.json()) as { status?: string };

        if (!isActive) {
          return;
        }

        if (body.status === 'ok') {
          setHealth({ status: 'ok' });
          return;
        }

        setHealth({ status: 'error', message: 'Unexpected health response.' });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setHealth({
          status: 'error',
          message: error instanceof Error ? error.message : 'Backend unavailable.',
        });
      }
    }

    void loadHealth();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Backend</p>
          <h3 className="text-xl font-semibold text-white">Health Status</h3>
        </div>
        <span
          className={
            health.status === 'ok'
              ? 'rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300'
              : health.status === 'error'
                ? 'rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-300'
                : 'rounded-full bg-slate-500/20 px-3 py-1 text-xs font-semibold text-slate-200'
          }
        >
          {health.status === 'ok'
            ? 'Operational'
            : health.status === 'error'
              ? 'Unavailable'
              : 'Checking'}
        </span>
      </div>
      <div className="mt-4 text-sm text-slate-300">
        {health.status === 'loading' && <p>Contacting the API...</p>}
        {health.status === 'ok' && <p>API responded with status: ok</p>}
        {health.status === 'error' && <p className="text-rose-200">{health.message}</p>}
      </div>
    </div>
  );
}
