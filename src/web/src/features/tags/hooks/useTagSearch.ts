import { useEffect, useState, useRef } from 'react';
import type { Tag } from '../../../types/entities';
import { tagsApi } from '../../../lib/api/tags';
import { mapTagDtoToTag } from '../../../lib/api/types';

export function useTagSearch(debounceMs = 300) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const currentRequestId = ++requestIdRef.current;
    const timeout = setTimeout(async () => {
      try {
        const response = await tagsApi.listTags(trimmed, undefined, 25);
        // Only update results if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          setResults(response.tags.map(mapTagDtoToTag));
        }
      } finally {
        // Only update loading state if this is still the latest request
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
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
