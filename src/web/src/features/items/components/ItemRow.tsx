import { formatDistanceToNow } from 'date-fns';
import { Star, ExternalLink, Archive } from 'lucide-react';
import type { Item } from '../../../types/entities';
import { cn } from '../../../lib/utils';

interface ItemRowProps {
  item: Item;
  isSelected?: boolean;
  onClick?: (item: Item) => void;
}

export function ItemRow({ item, isSelected = false, onClick }: ItemRowProps) {
  const handleClick = () => {
    onClick?.(item);
  };

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Wire to toggleFavorite in Phase 6 (US4)
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Wire to toggleArchive in Phase 6 (US4)
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        'group relative flex items-start gap-4 px-4 py-4 border-b border-neutral-100 cursor-pointer transition-colors duration-200',
        'hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none',
        isSelected && 'bg-indigo-50/60',
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
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
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
          className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
