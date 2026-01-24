import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ItemDetail } from '../../features/items/components/ItemDetail';
import { CreateCollectionDialog } from '../../features/collections/components/CreateCollectionDialog';
import { useUiStore } from '../../stores/ui-store';

export function Layout() {
  const isCreateCollectionOpen = useUiStore((state) => state.isCreateCollectionOpen);
  const closeCreateCollection = useUiStore((state) => state.closeCreateCollection);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-50">
      <Sidebar />
      <div className="flex flex-1 overflow-hidden relative">
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
