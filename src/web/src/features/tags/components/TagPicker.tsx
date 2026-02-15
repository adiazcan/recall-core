import { useMemo, useState, type KeyboardEvent } from 'react';
import type { Tag } from '../../../types/entities';
import { TagChip } from './TagChip';
import { useTagSearch } from '../hooks/useTagSearch';
import type { TagSummary } from '../../../types/entities';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { cn } from '../../../lib/utils';

export interface TagPickerSelection {
  selectedTags: TagSummary[];
  tagIds: string[];
  newTagNames: string[];
}

interface TagPickerProps {
  selectedTags: TagSummary[];
  onChange: (selection: TagPickerSelection) => void;
  maxTags?: number;
}

const NEW_TAG_PREFIX = 'new:';

const buildSelection = (selectedTags: TagSummary[]): TagPickerSelection => ({
  selectedTags,
  tagIds: selectedTags.filter((tag) => !tag.id.startsWith(NEW_TAG_PREFIX)).map((tag) => tag.id),
  newTagNames: selectedTags.filter((tag) => tag.id.startsWith(NEW_TAG_PREFIX)).map((tag) => tag.name),
});

export function TagPicker({ selectedTags, onChange, maxTags = 50 }: TagPickerProps) {
  const { query, setQuery, results, isLoading } = useTagSearch();
  const [activeIndex, setActiveIndex] = useState(0);

  const normalizedSelection = useMemo(
    () => new Set(selectedTags.map((tag) => tag.name.trim().toLowerCase())),
    [selectedTags],
  );

  const trimmedQuery = query.trim();

  const suggestions = useMemo<Tag[]>(
    () => results.filter((tag) => !normalizedSelection.has(tag.displayName.trim().toLowerCase())),
    [normalizedSelection, results],
  );

  const hasExactMatch = useMemo(
    () => suggestions.some((tag) => tag.normalizedName === trimmedQuery.toLowerCase()),
    [suggestions, trimmedQuery],
  );

  const createOptionVisible = Boolean(trimmedQuery) && !hasExactMatch;
  const totalOptions = suggestions.length + (createOptionVisible ? 1 : 0);

  const updateSelection = (nextSelectedTags: TagSummary[]) => {
    onChange(buildSelection(nextSelectedTags));
  };

  const addExistingTag = (tag: { id: string; displayName: string; color: string | null }) => {
    if (selectedTags.length >= maxTags) {
      return;
    }

    const nextTags = [
      ...selectedTags,
      {
        id: tag.id,
        name: tag.displayName,
        color: tag.color,
      },
    ];
    updateSelection(nextTags);
    setQuery('');
    setActiveIndex(0);
  };

  const addNewTagName = () => {
    if (!trimmedQuery || selectedTags.length >= maxTags) {
      return;
    }

    const normalized = trimmedQuery.toLowerCase();
    if (normalizedSelection.has(normalized)) {
      return;
    }

    const nextTags = [
      ...selectedTags,
      {
        id: `${NEW_TAG_PREFIX}${normalized}`,
        name: trimmedQuery,
        color: null,
      },
    ];

    updateSelection(nextTags);
    setQuery('');
    setActiveIndex(0);
  };

  const removeTag = (tagId: string) => {
    updateSelection(selectedTags.filter((tag) => tag.id !== tagId));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (totalOptions === 0) {
      if (event.key === 'Enter') {
        event.preventDefault();
        addNewTagName();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % totalOptions);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + totalOptions) % totalOptions);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex < suggestions.length) {
        addExistingTag(suggestions[activeIndex]);
      } else {
        addNewTagName();
      }
    }
  };

  return (
    <div className="space-y-2">
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <TagChip key={tag.id} tag={tag} onRemove={() => removeTag(tag.id)} />
          ))}
        </div>
      )}

      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search or create tags"
        aria-label="Search tags"
      />

      {trimmedQuery && (
        <ul className="rounded-md border border-neutral-200 bg-white">
          {suggestions.map((tag, index) => (
            <li key={tag.id}>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  'w-full justify-between rounded-none px-3 py-2 text-left text-sm text-neutral-900 hover:text-neutral-900',
                  index === activeIndex && 'bg-neutral-100',
                )}
                onClick={() => addExistingTag(tag)}
              >
                <span>{tag.displayName}</span>
                <span className="text-xs text-neutral-500">{tag.itemCount}</span>
              </Button>
            </li>
          ))}
          {createOptionVisible && (
            <li>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  'w-full justify-start rounded-none px-3 py-2 text-left text-sm text-neutral-900 hover:text-neutral-900',
                  activeIndex === suggestions.length && 'bg-neutral-100',
                )}
                onClick={addNewTagName}
              >
                Create &quot;{trimmedQuery}&quot;
              </Button>
            </li>
          )}
          {isLoading && (
            <li className="px-3 py-2 text-xs text-neutral-500">Searching…</li>
          )}
        </ul>
      )}
    </div>
  );
}
