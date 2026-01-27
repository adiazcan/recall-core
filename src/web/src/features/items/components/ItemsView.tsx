import { Plus, Menu } from 'lucide-react';
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
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

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
      <div className="flex-shrink-0 flex items-center justify-between gap-2 p-3 sm:p-4 md:p-6 border-b border-neutral-100">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8 flex-shrink-0"
            onClick={toggleSidebar}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-neutral-500 mb-0.5 sm:mb-1">Your library</p>
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-neutral-900 truncate">{viewState.title}</h2>
          </div>
        </div>
        <Button onClick={openSaveUrl} className="gap-1.5 sm:gap-2 text-xs sm:text-sm flex-shrink-0 px-2.5 sm:px-4">
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Save URL</span>
          <span className="sm:hidden">Save</span>
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        <SaveUrlDialog open={isSaveUrlOpen} onOpenChange={(open) => (open ? openSaveUrl() : closeSaveUrl())} />
        {!isLoading && items.length === 0 ? (
          <div className="p-3 sm:p-4 md:p-6">
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
    </div>
  );
}
