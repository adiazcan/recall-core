import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useTagsStore } from '../store';
import type { Tag } from '../../../types/entities';

export function TagManagement() {
  const tagsMap = useTagsStore((state) => state.tags);
  const isLoading = useTagsStore((state) => state.isLoading);
  const listTags = useTagsStore((state) => state.listTags);
  const updateTag = useTagsStore((state) => state.updateTag);
  const deleteTag = useTagsStore((state) => state.deleteTag);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const tags = useMemo<Tag[]>(() => {
    const values = Array.from(tagsMap.values()) as Tag[];
    return values.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
  }, [tagsMap]);

  useEffect(() => {
    void listTags();
  }, [listTags]);

  const beginEdit = (tagId: string, currentName: string) => {
    setEditingTagId(tagId);
    setEditingName(currentName);
  };

  const handleRename = async (tagId: string) => {
    const nextName = editingName.trim();
    if (!nextName) {
      return;
    }

    const updated = await updateTag(tagId, nextName);
    if (updated) {
      setEditingTagId(null);
      setEditingName('');
    }
  };

  const handleDelete = async (tagId: string, displayName: string) => {
    if (!window.confirm(`Delete tag "${displayName}"?`)) {
      return;
    }

    await deleteTag(tagId);
  };

  if (isLoading && tags.length === 0) {
    return <div className="px-4 py-6 text-sm text-neutral-500">Loading tags…</div>;
  }

  if (tags.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 px-4 py-8 text-center">
        <p className="text-sm text-neutral-600">No tags yet. Create tags from item forms using the tag picker.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tags.map((tag) => (
        <div key={tag.id} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
          <div className="min-w-0 flex-1">
            {editingTagId === tag.id ? (
              <Input
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleRename(tag.id);
                  }
                }}
                aria-label={`Rename ${tag.displayName}`}
              />
            ) : (
              <p className="truncate text-sm font-medium text-neutral-900">{tag.displayName}</p>
            )}
            <p className="text-xs text-neutral-500">{tag.itemCount} items</p>
          </div>

          <div className="ml-3 flex items-center gap-2">
            {editingTagId === tag.id ? (
              <>
                <Button type="button" size="sm" onClick={() => void handleRename(tag.id)}>
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingTagId(null);
                    setEditingName('');
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => beginEdit(tag.id, tag.displayName)}
                >
                  Rename
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleDelete(tag.id, tag.displayName)}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
