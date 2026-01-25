import { formatDistanceToNow } from 'date-fns';
import { Star, ExternalLink, Archive } from 'lucide-react';
import { useState, forwardRef } from 'react';
import type { Item } from '../../../types/entities';
import { cn } from '../../../lib/utils';
import { useItemsStore } from '../store';
import { useToastStore } from '../../../stores/toast-store';
import { useAuthorizedImageUrl } from '../../../lib/hooks/useAuthorizedImageUrl';

interface ItemRowProps {
  item: Item;
  isSelected?: boolean;
  isFocused?: boolean;
  onClick?: (item: Item) => void;
  onFocus?: () => void;
}

export const ItemRow = forwardRef<HTMLDivElement, ItemRowProps>(
  ({ item, isSelected = false, isFocused = false, onClick, onFocus }, ref) => {
  const toggleFavorite = useItemsStore((state) => state.toggleFavorite);
  const toggleArchive = useItemsStore((state) => state.toggleArchive);
  const { success, error } = useToastStore();
  const [isArchiving, setIsArchiving] = useState(false);
  const thumbnailUrl = useAuthorizedImageUrl(item.imageUrl);

  const handleClick = () => {
    onClick?.(item);
  };

  const handleStarClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleFavorite(item.id);
      success(item.isFavorite ? 'Removed from favorites' : 'Added to favorites');
    } catch {
      error('Failed to update favorite status');
    }
  };

  const handleArchiveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!item.isArchived) {
      setIsArchiving(true);
    }
    
    try {
      await toggleArchive(item.id);
      success(item.isArchived ? 'Unarchived' : 'Archived');
    } catch {
      error('Failed to update archive status');
      setIsArchiving(false);
    }
  };

  return (
    <div
      ref={ref}
      role="listitem"
      tabIndex={isFocused ? 0 : -1}
      onClick={handleClick}
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        'group relative flex items-start gap-4 px-4 py-4 border-b border-neutral-100 cursor-pointer transition-all duration-300',
        'hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset',
        isSelected && 'bg-indigo-50/60',
        isFocused && 'ring-2 ring-indigo-500 ring-inset',
        isArchiving && 'opacity-0 -translate-x-4',
      )}
    >
      {/* Favicon / Image Thumbnail */}
      <div className="flex-shrink-0 mt-1">
        <div
          className={cn(
            'w-12 h-12 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100 flex items-center justify-center',
            isSelected && 'border-indigo-200',
          )}
        >
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-neutral-400">
              {item.domain.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 pr-8">
        <div className="flex items-center gap-2 mb-1">
          <h3
            className={cn(
              'text-base font-semibold truncate',
              isSelected ? 'text-indigo-900' : 'text-neutral-900',
            )}
          >
            {item.title || new URL(item.url).hostname}
          </h3>
          {item.isFavorite && (
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
          )}
        </div>

        {item.excerpt && (
          <p className="text-sm text-neutral-500 mb-2 line-clamp-1">{item.excerpt}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <span className="font-medium text-neutral-500">{item.domain}</span>
          <span className="w-1 h-1 rounded-full bg-neutral-300" />
          <time dateTime={item.createdAt.toISOString()}>
            {formatDistanceToNow(item.createdAt, { addSuffix: true })}
          </time>

          {item.tags.length > 0 && (
            <>
              <span className="w-1 h-1 rounded-full bg-neutral-300" />
              <div className="flex items-center gap-2">
                {item.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                    #{tag}
                  </span>
                ))}
                {item.tags.length > 3 && <span>+{item.tags.length - 3}</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hover Actions */}
      <div
        className={cn(
          'absolute right-4 top-4 flex items-center gap-1 transition-opacity',
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <button
          onClick={handleStarClick}
          aria-label={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            item.isFavorite
              ? 'text-amber-400 hover:bg-amber-50'
              : 'text-neutral-400 hover:text-amber-500 hover:bg-amber-50',
          )}
        >
          <Star className={cn('h-4 w-4', item.isFavorite && 'fill-current')} />
        </button>
        <button
          onClick={handleArchiveClick}
          aria-label={item.isArchived ? 'Unarchive' : 'Archive'}
          title={item.isArchived ? 'Unarchive' : 'Archive'}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            item.isArchived
              ? 'text-indigo-600 hover:bg-indigo-50'
              : 'text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50',
          )}
        >
          <Archive className="h-4 w-4" />
        </button>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label="Open link in new tab"
          title="Open link in new tab"
          className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
});

ItemRow.displayName = 'ItemRow';
