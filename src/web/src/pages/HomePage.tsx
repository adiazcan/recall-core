import { HealthStatus } from '../components/HealthStatus';

export function HomePage() {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">System Status</p>
        <h2 className="text-3xl font-semibold text-white">Health Check</h2>
      </div>
      <HealthStatus />
    </section>
  );
}
