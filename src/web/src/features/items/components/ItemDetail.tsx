import { useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { X, ExternalLink, Star, Archive, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useItemsStore } from '../store';
import { cn } from '../../../lib/utils';

export function ItemDetail() {
  const selectedItemId = useItemsStore((state) => state.selectedItemId);
  const items = useItemsStore((state) => state.items);
  const selectItem = useItemsStore((state) => state.selectItem);

  const item = items.find((i) => i.id === selectedItemId);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        selectItem(null);
      }
    };

    if (selectedItemId) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [selectedItemId, selectItem]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-item-detail]')) {
        return;
      }
      if (selectedItemId && target.closest('[role="button"]')) {
        return;
      }
      if (selectedItemId) {
        selectItem(null);
      }
    };

    if (selectedItemId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [selectedItemId, selectItem]);

  if (!item) {
    return null;
  }

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 transition-opacity z-40',
          selectedItemId ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden="true"
      />

      {/* Side panel */}
      <div
        data-item-detail
        className={cn(
          'fixed right-0 top-0 h-full w-full sm:w-[500px] bg-background border-l shadow-xl z-50',
          'transition-transform duration-300 ease-in-out',
          'flex flex-col',
          selectedItemId ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Item Details</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => selectItem(null)}
            aria-label="Close details"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title and URL */}
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">
              {item.title || new URL(item.url).hostname}
            </h3>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
              <span className="truncate">{item.url}</span>
              <ExternalLink className="h-3 w-3 flex-shrink-0 group-hover:text-foreground" />
            </a>
          </div>

          {/* Domain */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Domain
            </p>
            <p className="text-sm">{item.domain}</p>
          </div>

          {/* Excerpt */}
          {item.excerpt && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Excerpt
              </p>
              <p className="text-sm text-muted-foreground">{item.excerpt}</p>
            </div>
          )}

          {/* Status */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </p>
            <div className="flex gap-2">
              <span
                className={cn(
                  'px-2 py-1 rounded text-xs font-medium',
                  item.status === 'unread' && 'bg-blue-100 text-blue-700',
                  item.status === 'archived' && 'bg-gray-100 text-gray-700',
                )}
              >
                {item.status}
              </span>
              {item.isFavorite && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                  Favorite
                </span>
              )}
            </div>
          </div>

          {/* Collection */}
          {item.collectionId && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Collection
              </p>
              <p className="text-sm">{item.collectionId}</p>
            </div>
          )}

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded text-xs font-medium bg-accent text-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Created</span>
              <time dateTime={item.createdAt.toISOString()}>
                {formatDistanceToNow(item.createdAt, { addSuffix: true })}
              </time>
            </div>
            <div className="flex justify-between">
              <span>Updated</span>
              <time dateTime={item.updatedAt.toISOString()}>
                {formatDistanceToNow(item.updatedAt, { addSuffix: true })}
              </time>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" disabled>
              <Star className="h-4 w-4" />
              {item.isFavorite ? 'Unfavorite' : 'Favorite'}
            </Button>
            <Button variant="outline" className="flex-1 gap-2" disabled>
              <Archive className="h-4 w-4" />
              {item.status === 'archived' ? 'Unarchive' : 'Archive'}
            </Button>
          </div>
          <Button variant="destructive" className="w-full gap-2" disabled>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
    </>
  );
}
