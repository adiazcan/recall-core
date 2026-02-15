import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { X, ExternalLink, Star, Archive, Trash2, Calendar } from 'lucide-react';
import FocusLock from 'react-focus-lock';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { useItemsStore } from '../store';
import { useCollectionsStore } from '../../collections/store';
import { useToastStore } from '../../../stores/toast-store';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { TagChip } from '../../tags/components/TagChip';
import { TagPicker, type TagPickerSelection } from '../../tags/components/TagPicker';
import { cn } from '../../../lib/utils';
import { useAuthorizedImageUrl } from '../../../lib/hooks/useAuthorizedImageUrl';

// Security: Validate URL protocol to prevent javascript: or data: URIs
function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function ItemDetail() {
  const selectedItemId = useItemsStore((state) => state.selectedItemId);
  const selectedItemSnapshot = useItemsStore((state) => state.selectedItemSnapshot);
  const items = useItemsStore((state) => state.items);
  const selectItem = useItemsStore((state) => state.selectItem);
  const deleteItem = useItemsStore((state) => state.deleteItem);
  const updateItem = useItemsStore((state) => state.updateItem);
  const toggleFavorite = useItemsStore((state) => state.toggleFavorite);
  const toggleArchive = useItemsStore((state) => state.toggleArchive);
  const collections = useCollectionsStore((state) => state.collections);
  const collectionsLoading = useCollectionsStore((state) => state.isLoading);
  const fetchCollections = useCollectionsStore((state) => state.fetchCollections);
  const success = useToastStore((state) => state.success);
  const error = useToastStore((state) => state.error);
  const [notes, setNotes] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const item = items.find((i) => i.id === selectedItemId) ?? selectedItemSnapshot;
  const thumbnailUrl = useAuthorizedImageUrl(item?.imageUrl);

  // Fetch collections when panel opens
  useEffect(() => {
    if (selectedItemId) {
      fetchCollections();
    }
  }, [selectedItemId, fetchCollections]);

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
    if (!selectedItemId) return;

    const focusTimer = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => cancelAnimationFrame(focusTimer);
  }, [selectedItemId]);


  const focusShards = useMemo(() => {
    if (!selectedItemId || typeof document === 'undefined') {
      return [];
    }

    return Array.from(document.querySelectorAll('[data-radix-portal]')) as HTMLElement[];
  }, [selectedItemId]);

  const selectedCollectionLabel = useMemo(() => {
    if (!item) {
      return 'Select a collection';
    }

    if (!item.collectionId) {
      return 'None';
    }

    const matched = collections.find((collection) => collection.id === item.collectionId);
    if (matched) {
      return matched.name;
    }

    return collectionsLoading ? 'Loading...' : 'Unknown collection';
  }, [collections, collectionsLoading, item]);

  if (!item) {
    return null;
  }

  const handleDelete = async () => {
    try {
      await deleteItem(item.id);
      success('Item deleted successfully');
      selectItem(null);
    } catch (err) {
      error('Failed to delete item');
    }
  };

  const handleCollectionChange = async (collectionId: string) => {
    if (!item) return;

    try {
      await updateItem(item.id, {
        collectionId: collectionId === 'none' ? '' : collectionId,
      });
      success('Collection updated');
    } catch (err) {
      error('Failed to update collection');
    }
  };

  const handleToggleFavorite = async () => {
    if (!item) return;

    try {
      await toggleFavorite(item.id);
      success(item.isFavorite ? 'Removed from favorites' : 'Added to favorites');
    } catch (err) {
      error('Failed to update favorite status');
    }
  };

  const handleToggleArchive = async () => {
    if (!item) return;

    try {
      await toggleArchive(item.id);
      success(item.isArchived ? 'Unarchived' : 'Archived');
    } catch (err) {
      error('Failed to update archive status');
    }
  };

  const handleTagSelectionChange = async (selection: TagPickerSelection) => {
    if (!item || isSavingTags) {
      return;
    }

    setIsSavingTags(true);
    try {
      await updateItem(item.id, {
        tagIds: selection.tagIds,
        newTagNames: selection.newTagNames,
      });
      success('Tags updated');
    } catch {
      error('Failed to update tags');
    } finally {
      setIsSavingTags(false);
    }
  };

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 transition-opacity z-40',
          selectedItemId ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden="true"
        onClick={() => {
          if (selectedItemId) {
            selectItem(null);
          }
        }}
      />

      {/* Side panel */}
      <FocusLock
        disabled={!selectedItemId}
        returnFocus
        autoFocus={false}
        shards={focusShards}
      >
        <div
          data-item-detail
          role="dialog"
          aria-modal="true"
          aria-label="Item details"
          className={cn(
            'fixed right-0 top-0 h-full w-full sm:w-[400px] md:w-[500px] lg:w-[680px] bg-white shadow-xl z-50',
            'transition-transform duration-300 ease-in-out',
            'flex flex-col',
            selectedItemId ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          {/* Header with actions */}
          <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-neutral-200">
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="icon"
              onClick={() => selectItem(null)}
              aria-label="Close"
              className="h-7 w-7 sm:h-8 sm:w-8 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            
            <div className="flex items-center gap-0.5 sm:gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                className="h-7 w-7 sm:h-8 sm:w-8 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100"
                onClick={handleToggleFavorite}
              >
                <Star className={cn('h-4 w-4 sm:h-5 sm:w-5', item.isFavorite && 'fill-yellow-400 text-yellow-400')} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={item.isArchived ? 'Unarchive' : 'Archive'}
                title={item.isArchived ? 'Unarchive' : 'Archive'}
                className="h-7 w-7 sm:h-8 sm:w-8 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100"
                onClick={handleToggleArchive}
              >
                <Archive className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete"
                title="Delete"
                className="h-7 w-7 sm:h-8 sm:w-8 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 sm:px-4 md:px-6 pb-6 sm:pb-8 space-y-4 sm:space-y-6">
            {/* Image preview placeholder */}
            {thumbnailUrl && (
              <div className="w-full aspect-video bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg overflow-hidden">
                <img 
                  src={thumbnailUrl} 
                  alt={item.title || 'Item preview'} 
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Title */}
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-neutral-900 mb-2 sm:mb-3">
                {item.title || new URL(item.url).hostname}
              </h1>
              
              {/* URL */}
              {isValidHttpUrl(item.url) ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open link in new tab"
                  className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">{item.url}</span>
                </a>
              ) : (
                <div className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-neutral-500">
                  <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">{item.url}</span>
                  <span className="text-xs text-red-600">(Invalid URL protocol)</span>
                </div>
              )}
            </div>

            {/* Collection */}
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                <Archive className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span>Collection</span>
              </div>
              <Select
                value={item.collectionId || 'none'}
                onValueChange={handleCollectionChange}
              >
                <SelectTrigger className="w-full h-9 sm:h-10 text-xs sm:text-sm" aria-busy={collectionsLoading}>
                  <span
                    className={cn(
                      'truncate',
                      item.collectionId ? 'text-neutral-900' : 'text-neutral-500',
                    )}
                  >
                    {selectedCollectionLabel}
                  </span>
                  <SelectValue className="sr-only" placeholder="Select a collection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {collectionsLoading && collections.length === 0 ? (
                    <SelectItem value="loading" disabled>
                      Loading collections...
                    </SelectItem>
                  ) : (
                    collections.map((collection) => (
                      <SelectItem key={collection.id} value={collection.id}>
                        {collection.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                <span>#</span>
                <span>Tags</span>
              </div>
              <TagPicker
                selectedTags={item.tags}
                onChange={(selection) => void handleTagSelectionChange(selection)}
                maxTags={50}
              />
            </div>

            {/* Added timestamp */}
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span>Added</span>
              </div>
              <div className="text-sm sm:text-base text-neutral-900">
                {format(item.createdAt, 'MMMM d, yyyy')} • {format(item.createdAt, 'h:mm a')}
              </div>
            </div>

            {/* Excerpt */}
            {item.excerpt && (
              <div className="space-y-1.5 sm:space-y-2">
                <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Description
                </div>
                <p className="text-sm sm:text-base text-neutral-700 leading-relaxed">{item.excerpt}</p>
              </div>
            )}

            {/* Personal Notes */}
            <div className="space-y-2 sm:space-y-3">
              <h3 className="text-base sm:text-lg font-semibold text-neutral-900">
                Personal Notes
              </h3>
              <Textarea
                placeholder="Add your thoughts here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-24 sm:min-h-32 resize-none border-neutral-200 focus-visible:border-neutral-400 text-sm sm:text-base"
                disabled
              />
            </div>
          </div>
        </div>
      </div>
      </FocusLock>

      {/* Delete confirmation dialog */}
      <ConfirmDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        itemTitle={item.title || undefined}
      />
    </>
  );
}
