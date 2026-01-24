import { LoadingState } from '../../../components/common/LoadingState';
import { EmptyState } from '../../../components/common/EmptyState';
import type { Item } from '../../../types/entities';
import { ItemRow } from './ItemRow';
import { useEffect, useRef, useState } from 'react';

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
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Reset focused index when items change
  useEffect(() => {
    if (items.length === 0) {
      setFocusedIndex(-1);
    } else if (focusedIndex >= items.length) {
      setFocusedIndex(items.length - 1);
    }
  }, [items.length, focusedIndex]);

  // Intersection Observer for auto-scroll pagination
  useEffect(() => {
    if (!hasMore || isLoadingMore || !loadMoreTriggerRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      {
        root: containerRef.current,
        rootMargin: '100px', // Trigger 100px before reaching the bottom
        threshold: 0.1,
      }
    );

    observer.observe(loadMoreTriggerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Scroll to focused item
  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < items.length) {
      const itemId = items[focusedIndex].id;
      const element = itemRefs.current.get(itemId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [focusedIndex, items]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (items.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev < items.length - 1 ? prev + 1 : prev;
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          return next;
        });
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(items.length - 1);
        break;
      case 'Enter':
      case ' ':
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          e.preventDefault();
          onItemClick(items[focusedIndex]);
        }
        break;
    }
  };

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
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="list"
        aria-label="Items list"
      >
        {items.map((item, index) => (
          <ItemRow
            key={item.id}
            item={item}
            isSelected={selectedItemId === item.id}
            isFocused={focusedIndex === index}
            onClick={onItemClick}
            onFocus={() => setFocusedIndex(index)}
            ref={(el) => {
              if (el) {
                itemRefs.current.set(item.id, el);
              } else {
                itemRefs.current.delete(item.id);
              }
            }}
          />
        ))}

        {/* Intersection Observer trigger element */}
        {hasMore && (
          <div
            ref={loadMoreTriggerRef}
            className="h-20 flex items-center justify-center"
          >
            {isLoadingMore && (
              <div className="text-sm text-muted-foreground">
                Loading more items...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
