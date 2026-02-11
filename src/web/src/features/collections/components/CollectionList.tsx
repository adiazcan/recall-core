import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Folder } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useCollectionsStore } from '../store';
import { useUiStore } from '../../../stores/ui-store';
import type { ViewState } from '../../../types/views';

export function CollectionList() {
  const collections = useCollectionsStore((state) => state.collections);
  const isLoading = useCollectionsStore((state) => state.isLoading);
  const fetchCollections = useCollectionsStore((state) => state.fetchCollections);
  const setViewState = useUiStore((state) => state.setViewState);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const handleCollectionClick = (collectionId: string, collectionName: string) => {
    const newViewState: ViewState = {
      type: 'collection',
      id: collectionId,
      title: collectionName,
    };
    setViewState(newViewState);
  };

  if (isLoading && collections.length === 0) {
    return (
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 bg-neutral-100 rounded-[10px] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {collections.map((collection) => (
        <NavLink
          key={collection.id}
          to={`/collections/${collection.id}`}
          onClick={() => handleCollectionClick(collection.id, collection.name)}
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
              <Folder className={cn('h-4 w-4', isActive ? 'text-indigo-600' : 'text-neutral-500')} />
              <span className="flex-1 text-left truncate">{collection.name}</span>
              <span className="text-xs text-neutral-400">{collection.itemCount}</span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}
