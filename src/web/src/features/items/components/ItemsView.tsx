import { Plus, Menu, Search, SlidersHorizontal } from 'lucide-react';
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
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen);

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
      <div className="flex-shrink-0 flex items-center justify-between gap-4 h-16 px-6 bg-white/80 backdrop-blur-sm border-b border-neutral-200">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8 flex-shrink-0"
            onClick={toggleSidebar}
            aria-label="Toggle menu"
            aria-expanded={isSidebarOpen}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex items-center gap-3">
            <h2 className="text-xl font-semibold tracking-[-0.45px] text-neutral-900 leading-7 truncate">{viewState.title}</h2>
            <span className="bg-neutral-100 rounded-full h-6 px-2 text-sm font-medium text-neutral-400 leading-5 flex items-center">
              {items.length}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <div className="w-48 h-8 relative">
              <Search className="w-4 h-4 absolute left-3 top-2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search..."
                aria-label="Search items"
                className="w-full h-full bg-neutral-100 rounded-[10px] pl-9 pr-4 text-sm placeholder:text-neutral-900/50 tracking-[-0.15px] border-0 focus-visible:ring-2 focus-visible:ring-neutral-200"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-2 text-neutral-500 hover:text-neutral-900"
              aria-label="Filter items (coming soon)"
              disabled
              aria-disabled="true"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={openSaveUrl}
            className="h-8 px-3 gap-2 rounded-[10px] bg-neutral-900 text-white text-sm font-medium tracking-[-0.15px] shadow-sm hover:bg-neutral-900/90"
          >
            <Plus className="h-4 w-4" />
            <span>Save URL</span>
          </Button>
        </div>
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
