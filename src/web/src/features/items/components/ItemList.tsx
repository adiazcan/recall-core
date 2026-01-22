import { Button } from '../../../components/ui/button';
import { LoadingState } from '../../../components/common/LoadingState';
import { EmptyState } from '../../../components/common/EmptyState';
import type { Item } from '../../../types/entities';
import { ItemRow } from './ItemRow';

interface ItemListProps {
  items: Item[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  selectedItemId: string | null;
  onItemClick: (item: Item) => void;
  onLoadMore: () => void;
}

export function ItemList({
  items,
  isLoading,
  isLoadingMore,
  hasMore,
  selectedItemId,
  onItemClick,
  onLoadMore,
}: ItemListProps) {
  if (isLoading) {
    return <LoadingState message="Loading items..." />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No items found"
        description="Try adjusting your filters or save a new URL to get started."
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            isSelected={selectedItemId === item.id}
            onClick={onItemClick}
          />
        ))}
      </div>

      {hasMore && (
        <div className="p-4 border-t">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="w-full"
          >
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
