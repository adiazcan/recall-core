import { useEffect } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useUiStore } from '../../../stores/ui-store';
import { useItemsStore } from '../store';
import { viewStateToFilterParams } from '../../../types/views';
import { SaveUrlForm } from './SaveUrlForm';
import { ItemList } from './ItemList';
import { ErrorState } from '../../../components/common/ErrorState';

export function ItemsView() {
  const viewState = useUiStore((state) => state.viewState);
  const isSaveUrlOpen = useUiStore((state) => state.isSaveUrlOpen);
  const openSaveUrl = useUiStore((state) => state.openSaveUrl);
  const closeSaveUrl = useUiStore((state) => state.closeSaveUrl);

  const items = useItemsStore((state) => state.items);
  const isLoading = useItemsStore((state) => state.isLoading);
  const isLoadingMore = useItemsStore((state) => state.isLoadingMore);
  const hasMore = useItemsStore((state) => state.hasMore);
  const selectedItemId = useItemsStore((state) => state.selectedItemId);
  const error = useItemsStore((state) => state.error);
  const fetchItems = useItemsStore((state) => state.fetchItems);
  const fetchMore = useItemsStore((state) => state.fetchMore);
  const selectItem = useItemsStore((state) => state.selectItem);
  const clearError = useItemsStore((state) => state.clearError);

  useEffect(() => {
    const filterParams = viewStateToFilterParams(viewState);
    fetchItems(filterParams);
  }, [viewState, fetchItems]);

  if (error) {
    return (
      <ErrorState
        title="Failed to load items"
        message={error}
        onAction={() => {
          clearError();
          const filterParams = viewStateToFilterParams(viewState);
          fetchItems(filterParams);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="h-16 border-b border-neutral-200 flex items-center justify-between px-6 flex-shrink-0 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-neutral-900">{viewState.title}</h2>
          <span className="text-sm text-neutral-400 font-medium bg-neutral-100 px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-neutral-600 transition-colors" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-9 pr-4 py-1.5 text-sm bg-neutral-100 border-transparent rounded-lg focus:bg-white focus:border-neutral-300 focus:ring-0 w-48 transition-all"
            />
          </div>

          <button className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors">
            <Filter className="w-4 h-4" />
          </button>

          <Button
            onClick={openSaveUrl}
            className="gap-2 bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Save URL
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {isSaveUrlOpen && (
          <div className="absolute top-4 left-6 right-6 z-20">
            <SaveUrlForm
              onSaved={closeSaveUrl}
              onCancel={closeSaveUrl}
            />
          </div>
        )}
        <ItemList
          items={items}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          selectedItemId={selectedItemId}
          onItemClick={(item) => selectItem(item.id)}
          onLoadMore={fetchMore}
        />
      </div>
    </div>
  );
}
