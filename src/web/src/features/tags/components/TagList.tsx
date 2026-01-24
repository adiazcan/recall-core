import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Tag as TagIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useTagsStore } from '../store';
import { useUiStore } from '../../../stores/ui-store';
import type { ViewState } from '../../../types/views';

export function TagList() {
  const tags = useTagsStore((state) => state.tags);
  const hasLoaded = useTagsStore((state) => state.hasLoaded);
  const isLoading = useTagsStore((state) => state.isLoading);
  const fetchTags = useTagsStore((state) => state.fetchTags);
  const setViewState = useUiStore((state) => state.setViewState);

  useEffect(() => {
    // Only fetch once if we don't have tags and aren't currently loading
    if (!hasLoaded && tags.length === 0 && !isLoading) {
      fetchTags();
    }
  }, [fetchTags, hasLoaded, tags.length, isLoading]);

  const handleTagClick = (tagName: string) => {
    const newViewState: ViewState = {
      type: 'tag',
      id: tagName,
      title: `#${tagName}`,
    };
    setViewState(newViewState);
  };

  // Extract just the background color from the color string
  const getBackgroundColor = (colorClasses?: string): string => {
    if (!colorClasses) return 'bg-green-500';
    // Color classes come as "bg-orange-100 text-orange-700"
    // We want a solid version for the dot, so map bg-X-100 to bg-X-500
    const match = colorClasses.match(/bg-(\w+)-\d+/);
    if (match) {
      return `bg-${match[1]}-500`;
    }
    return 'bg-green-500';
  };

  if (isLoading && tags.length === 0) {
    return (
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-neutral-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="px-3 py-4 text-sm text-neutral-500 text-center">
        No tags yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tags.map((tag) => (
        <NavLink
          key={tag.name}
          to={`/tags/${encodeURIComponent(tag.name)}`}
          onClick={() => handleTagClick(tag.name)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-neutral-100 text-neutral-900'
                : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
            )
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={cn(
                  'h-3 w-3 rounded-full',
                  getBackgroundColor(tag.color),
                )}
                aria-hidden="true"
              />
              <span className="flex-1 text-left truncate">#{tag.name}</span>
              <span className="text-xs text-neutral-400">{tag.count}</span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}
