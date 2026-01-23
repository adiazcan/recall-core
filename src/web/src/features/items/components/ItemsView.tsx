import { Plus } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/common/EmptyState';
import { useUiStore } from '../../../stores/ui-store';
import { viewStateToFilterParams } from '../../../types/views';
import { useItemsStore } from '../store';
import { ItemList } from './ItemList';
import { SaveUrlDialog } from './SaveUrlDialog';

export function ItemsView() {
  const viewState = useUiStore((state) => state.viewState);
  const isSaveUrlOpen = useUiStore((state) => state.isSaveUrlOpen);
  const openSaveUrl = useUiStore((state) => state.openSaveUrl);
  const closeSaveUrl = useUiStore((state) => state.closeSaveUrl);

  const { items, isLoading, isLoadingMore, hasMore, fetchItems, fetchMore, selectItem, selectedItemId } = useItemsStore();

  // Fetch items when view state changes
  useEffect(() => {
    const filterParams = viewStateToFilterParams(viewState);
    fetchItems(filterParams);
  }, [viewState]); // fetchItems is stable from zustand, no need to include it

  const handleItemClick = (item: { id: string }) => {
    selectItem(item.id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-neutral-100">
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Your library</p>
          <h2 className="text-2xl font-semibold text-neutral-900">{viewState.title}</h2>
        </div>
        <Button onClick={openSaveUrl} className="gap-2">
          <Plus className="h-4 w-4" />
          Save URL
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {!isLoading && items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No items found"
              description={
                viewState.type === 'inbox'
                  ? "You haven't saved any URLs yet. Click 'Save URL' to get started."
                  : 'Try adjusting your filters or save a new URL to get started.'
              }
            />
          </div>
        ) : (
          <ItemList
            items={items}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            selectedItemId={selectedItemId}
            onItemClick={handleItemClick}
            onLoadMore={fetchMore}
          />
        )}
      </div>

      <SaveUrlDialog open={isSaveUrlOpen} onOpenChange={(open) => (open ? openSaveUrl() : closeSaveUrl())} />
    </div>
  );
}
