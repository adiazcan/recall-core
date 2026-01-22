import { formatDistanceToNow } from 'date-fns';
import { Star, ExternalLink } from 'lucide-react';
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
        'group relative flex flex-col gap-1 px-4 py-3 border-b cursor-pointer transition-colors',
        'hover:bg-accent focus:bg-accent focus:outline-none',
        isSelected && 'bg-accent',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">
            {item.title || new URL(item.url).hostname}
          </h3>
          <p className="text-xs text-muted-foreground truncate">{item.domain}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleStarClick}
            aria-label={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className={cn(
              'p-1 rounded hover:bg-background/50 transition-colors',
              item.isFavorite ? 'text-yellow-500' : 'text-muted-foreground',
            )}
          >
            <Star className={cn('h-4 w-4', item.isFavorite && 'fill-current')} />
          </button>

          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Open link in new tab"
            className="p-1 rounded hover:bg-background/50 transition-colors text-muted-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {item.excerpt && (
        <p className="text-xs text-muted-foreground line-clamp-2">{item.excerpt}</p>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <time dateTime={item.createdAt.toISOString()}>
          {formatDistanceToNow(item.createdAt, { addSuffix: true })}
        </time>

        {item.tags.length > 0 && (
          <>
            <span>•</span>
            <div className="flex gap-1 flex-wrap">
              {item.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 rounded bg-accent text-foreground">
                  {tag}
                </span>
              ))}
              {item.tags.length > 3 && (
                <span className="px-1.5 py-0.5">+{item.tags.length - 3}</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
