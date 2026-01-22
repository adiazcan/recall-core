import { Menu } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { useUiStore } from '../../stores/ui-store';
import { cn } from '../../lib/utils';
import { Sidebar } from './Sidebar';
import { ItemDetail } from '../../features/items/components/ItemDetail';

export function Layout() {
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            'border-r border-slate-800 bg-slate-950/80 transition-all md:w-64',
            isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden md:w-16',
          )}
        >
          <Sidebar isCollapsed={!isSidebarOpen} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSidebar}
                className="rounded-lg border border-slate-800 p-2 text-slate-300 transition hover:text-white"
                aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              >
                <Menu className="h-4 w-4" />
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Recall</p>
                <h1 className="text-lg font-semibold text-white">Library</h1>
              </div>
            </div>
            <span className="text-xs text-slate-500">Web Integration</span>
          </header>
          <main className="flex-1 px-6 py-8">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Item detail slide-out panel */}
      <ItemDetail />
    </div>
  );
}
