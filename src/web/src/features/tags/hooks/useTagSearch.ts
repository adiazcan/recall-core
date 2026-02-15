import { useEffect, useState } from 'react';
import type { Tag } from '../../../types/entities';
import { tagsApi } from '../../../lib/api/tags';
import { mapTagDtoToTag } from '../../../lib/api/types';

export function useTagSearch(debounceMs = 300) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await tagsApi.listTags(trimmed, undefined, 25);
        setResults(response.tags.map(mapTagDtoToTag));
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [debounceMs, query]);

  return {
    query,
    setQuery,
    results,
    isLoading,
  };
}
