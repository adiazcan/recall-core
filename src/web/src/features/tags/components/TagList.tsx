import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Hash } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTagsStore } from '../store';
import { useUiStore } from '../../../stores/ui-store';
import type { ViewState } from '../../../types/views';

export function TagList() {
  const tagsMap = useTagsStore((state) => state.tags);
  const hasLoaded = useTagsStore((state) => state.hasLoaded);
  const isLoading = useTagsStore((state) => state.isLoading);
  const listTags = useTagsStore((state) => state.listTags);
  const setViewState = useUiStore((state) => state.setViewState);
  const tags = Array.from(tagsMap.values()).sort((a, b) =>
    a.normalizedName.localeCompare(b.normalizedName),
  );

  useEffect(() => {
    if (!hasLoaded && tags.length === 0 && !isLoading) {
      void listTags();
    }
  }, [hasLoaded, isLoading, listTags, tags.length]);

  const handleTagClick = (tagId: string, tagName: string) => {
    const newViewState: ViewState = {
      type: 'tag',
      id: tagId,
      title: `#${tagName}`,
    };
    setViewState(newViewState);
  };

  if (isLoading && tags.length === 0) {
    return (
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 bg-neutral-100 rounded-[10px] animate-pulse" />
        ))}
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="px-2 sm:px-3 py-3 sm:py-4 text-xs sm:text-sm text-neutral-500 text-center">
        No tags yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tags.map((tag) => (
        <NavLink
          key={tag.id}
          to={`/tags/${tag.id}`}
          onClick={() => handleTagClick(tag.id, tag.displayName)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 h-9 rounded-[10px] text-sm font-medium transition-colors',
              isActive
                ? 'bg-neutral-100 text-neutral-900'
                : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Hash
                className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-indigo-600' : 'text-neutral-500')}
                aria-hidden="true"
              />
              <span className="flex-1 text-left truncate">{tag.displayName}</span>
              <span className="text-xs text-neutral-400 tabular-nums">{tag.itemCount}</span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}
