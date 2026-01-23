import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { X, ExternalLink, Star, Archive, Trash2, Calendar, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Input } from '../../../components/ui/input';
import { useItemsStore } from '../store';
import { useCollectionsStore } from '../../collections/store';
import { useToastStore } from '../../../stores/toast-store';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { TagChip } from '../../tags/components/TagChip';
import { cn } from '../../../lib/utils';

export function ItemDetail() {
  const selectedItemId = useItemsStore((state) => state.selectedItemId);
  const items = useItemsStore((state) => state.items);
  const selectItem = useItemsStore((state) => state.selectItem);
  const deleteItem = useItemsStore((state) => state.deleteItem);
  const updateItem = useItemsStore((state) => state.updateItem);
  const collections = useCollectionsStore((state) => state.collections);
  const fetchCollections = useCollectionsStore((state) => state.fetchCollections);
  const success = useToastStore((state) => state.success);
  const error = useToastStore((state) => state.error);
  const [notes, setNotes] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  const item = items.find((i) => i.id === selectedItemId);

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

  const handleAddTag = async () => {
    if (!item || !newTagInput.trim()) return;

    const tagName = newTagInput.trim();
    
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
      />

      {/* Side panel */}
      <div
        data-item-detail
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
              className="h-8 w-8 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100"
              disabled
            >
              <Star className={cn('h-5 w-5', item.isFavorite && 'fill-yellow-400 text-yellow-400')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Archive"
              className="h-8 w-8 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100"
              disabled
            >
              <Archive className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete"
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
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="truncate">{item.url}</span>
              </a>
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
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a collection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {collections.map((collection) => (
                    <SelectItem key={collection.id} value={collection.id}>
                      {collection.name}
                    </SelectItem>
                  ))}
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
                    <Input
                      type="text"
                      placeholder="Tag name"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddTag();
                        } else if (e.key === 'Escape') {
                          setIsAddingTag(false);
                          setNewTagInput('');
                        }
                      }}
                      className="h-8 w-32 text-sm"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleAddTag}
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
