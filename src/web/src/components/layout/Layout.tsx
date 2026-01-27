import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ItemDetail } from '../../features/items/components/ItemDetail';
import { CreateCollectionDialog } from '../../features/collections/components/CreateCollectionDialog';
import { useUiStore } from '../../stores/ui-store';
import { cn } from '../../lib/utils';

export function Layout() {
  const isCreateCollectionOpen = useUiStore((state) => state.isCreateCollectionOpen);
  const closeCreateCollection = useUiStore((state) => state.closeCreateCollection);
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-50">
      {/* Mobile sidebar overlay backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 z-30 md:hidden transition-opacity',
          isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={() => setSidebarOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSidebarOpen(false);
          }
        }}
        role="button"
        tabIndex={isSidebarOpen ? 0 : -1}
        aria-label="Close sidebar"
      />
      {/* Sidebar - fixed overlay on mobile, static on desktop */}
      <div
        className={cn(
          'fixed md:static inset-y-0 left-0 z-40 transform transition-transform duration-200 ease-in-out md:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden relative min-w-0">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
        {/* Item detail slide-out panel */}
        <ItemDetail />
      </div>
      {/* Global modals */}
      <CreateCollectionDialog
        open={isCreateCollectionOpen}
        onOpenChange={(open) => (!open ? closeCreateCollection() : undefined)}
      />
    </div>
  );
}
