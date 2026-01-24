import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { X, ExternalLink, Star, Archive, Trash2, Calendar, Plus, Check, ChevronsUpDown } from 'lucide-react';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '../../../components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../components/ui/popover';
import { Input } from '../../../components/ui/input';
import { useItemsStore } from '../store';
import { useCollectionsStore } from '../../collections/store';
import { useTagsStore } from '../../tags/store';
import { useToastStore } from '../../../stores/toast-store';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { TagChip } from '../../tags/components/TagChip';
import { cn } from '../../../lib/utils';

// Security: Validate URL protocol to prevent javascript: or data: URIs
function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Security: Sanitize tag names to prevent XSS/injection
function isValidTagName(tag: string): boolean {
  return /^[a-zA-Z0-9-_]+$/.test(tag);
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
  const tags = useTagsStore((state) => state.tags);
  const fetchTags = useTagsStore((state) => state.fetchTags);
  const success = useToastStore((state) => state.success);
  const error = useToastStore((state) => state.error);
  const [notes, setNotes] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const item = selectedItemSnapshot ?? items.find((i) => i.id === selectedItemId);

  // Fetch collections and tags when panel opens
  useEffect(() => {
    if (selectedItemId) {
      fetchCollections();
      fetchTags();
    }
  }, [selectedItemId, fetchCollections, fetchTags]);

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
  }, [selectedItemId, comboboxOpen]);

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
        collectionId: collectionId === 'none' ? null : collectionId,
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

  const handleAddTag = async () => {
    if (!item || !newTagInput.trim()) return;

    const tagName = newTagInput.trim();
    setComboboxOpen(false);
    
    // Security: Validate tag name format to prevent XSS/injection
    if (!isValidTagName(tagName)) {
      error('Tag name can only contain letters, numbers, hyphens, and underscores');
      return;
    }
    
    // Check if tag already exists
    if (item.tags.includes(tagName)) {
      error('Tag already exists');
      return;
    }

    // Validate tag name length
    if (tagName.length > 50) {
      error('Tag name too long (max 50 characters)');
      return;
    }

    // Check max tags limit
    if (item.tags.length >= 20) {
      error('Maximum 20 tags per item');
      return;
    }

    try {
      await updateItem(item.id, {
        tags: [...item.tags, tagName],
      });
      setNewTagInput('');
      setIsAddingTag(false);
      success('Tag added');
    } catch (err) {
      error('Failed to add tag');
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!item) return;

    try {
      await updateItem(item.id, {
        tags: item.tags.filter((t) => t !== tagName),
      });
      success('Tag removed');
    } catch (err) {
      error('Failed to remove tag');
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
            'fixed right-0 top-0 h-full w-full sm:w-[680px] bg-white shadow-xl z-50',
            'transition-transform duration-300 ease-in-out',
            'flex flex-col',
            selectedItemId ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          {/* Header with actions */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="icon"
              onClick={() => selectItem(null)}
              aria-label="Close"
              className="h-8 w-8 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100"
            >
              <X className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                className="h-8 w-8 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100"
                onClick={handleToggleFavorite}
              >
                <Star className={cn('h-5 w-5', item.isFavorite && 'fill-yellow-400 text-yellow-400')} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={item.isArchived ? 'Unarchive' : 'Archive'}
                title={item.isArchived ? 'Unarchive' : 'Archive'}
                className="h-8 w-8 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100"
                onClick={handleToggleArchive}
              >
                <Archive className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete"
                title="Delete"
                className="h-8 w-8 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pb-8 space-y-6">
            {/* Image preview placeholder */}
            {item.imageUrl && (
              <div className="w-full aspect-video bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg overflow-hidden">
                <img 
                  src={item.imageUrl} 
                  alt={item.title || 'Item preview'} 
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Title */}
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900 mb-3">
                {item.title || new URL(item.url).hostname}
              </h1>
              
              {/* URL */}
              {isValidHttpUrl(item.url) ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open link in new tab"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="truncate">{item.url}</span>
                </a>
              ) : (
                <div className="inline-flex items-center gap-2 text-sm text-neutral-500">
                  <ExternalLink className="h-4 w-4" />
                  <span className="truncate">{item.url}</span>
                  <span className="text-xs text-red-600">(Invalid URL protocol)</span>
                </div>
              )}
            </div>

            {/* Collection */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                <Archive className="h-3.5 w-3.5" />
                <span>Collection</span>
              </div>
              <Select
                value={item.collectionId || 'none'}
                onValueChange={handleCollectionChange}
              >
                <SelectTrigger className="w-full" aria-busy={collectionsLoading}>
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
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                <span>#</span>
                <span>Tags</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <TagChip key={tag} name={tag} onRemove={() => handleRemoveTag(tag)} />
                ))}
                
                {isAddingTag ? (
                  <div className="flex items-center gap-2">
                    <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={comboboxOpen}
                          aria-label="Select or create tag"
                          className="h-8 w-[200px] justify-between text-sm"
                        >
                          {newTagInput || "Select or type tag..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="start">
                        <Command
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newTagInput.trim()) {
                              e.preventDefault();
                              handleAddTag();
                            }
                          }}
                        >
                          <CommandInput 
                            placeholder="Search or type tag..." 
                            value={newTagInput}
                            onValueChange={setNewTagInput}
                          />
                          <CommandEmpty>
                            {newTagInput && isValidTagName(newTagInput) ? (
                              <div className="py-2 text-sm text-neutral-600">
                                Press Enter to create "{newTagInput}"
                              </div>
                            ) : (
                              <div className="py-2 text-sm text-neutral-500">
                                {newTagInput ? 'Invalid tag name format' : 'No tags found'}
                              </div>
                            )}
                          </CommandEmpty>
                          <CommandGroup>
                            {tags
                              .filter((tag) => !item?.tags.includes(tag.name))
                              .map((tag) => (
                                <CommandItem
                                  key={tag.name}
                                  value={tag.name}
                                  onSelect={(currentValue) => {
                                    setNewTagInput(currentValue);
                                    // Immediately add the selected tag
                                    setTimeout(() => handleAddTag(), 0);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      newTagInput === tag.name ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  #{tag.name}
                                  <span className="ml-auto text-xs text-neutral-400">{tag.count}</span>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleAddTag}
                      disabled={!newTagInput.trim()}
                      className="h-8 px-2"
                    >
                      Add
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsAddingTag(false);
                        setNewTagInput('');
                        setComboboxOpen(false);
                      }}
                      className="h-8 px-2"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingTag(true)}
                    className="h-auto px-3 py-1.5 rounded-full text-sm text-neutral-600 hover:bg-neutral-100"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            </div>

            {/* Added timestamp */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5" />
                <span>Added</span>
              </div>
              <div className="text-base text-neutral-900">
                {format(item.createdAt, 'MMMM d, yyyy')} • {format(item.createdAt, 'h:mm a')}
              </div>
            </div>

            {/* Excerpt */}
            {item.excerpt && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Description
                </div>
                <p className="text-base text-neutral-700 leading-relaxed">{item.excerpt}</p>
              </div>
            )}

            {/* Personal Notes */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-neutral-900">
                Personal Notes
              </h3>
              <Textarea
                placeholder="Add your thoughts here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-32 resize-none border-neutral-200 focus-visible:border-neutral-400"
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
