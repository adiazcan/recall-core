import { useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useUiStore } from '../../../stores/ui-store';
import { useItemsStore } from '../store';
import { viewStateToFilterParams } from '../../../types/views';
import { SaveUrlDialog } from './SaveUrlDialog';
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Save for later
          </p>
          <h2 className="text-2xl font-semibold">{viewState.title}</h2>
        </div>
        <Button onClick={openSaveUrl} className="gap-2">
          <Plus className="h-4 w-4" />
          Save URL
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
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

      <SaveUrlDialog
        open={isSaveUrlOpen}
        onOpenChange={(open) => (open ? openSaveUrl() : closeSaveUrl())}
      />
    </div>
  );
}
