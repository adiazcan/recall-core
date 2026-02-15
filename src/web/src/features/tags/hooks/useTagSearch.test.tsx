import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTagSearch } from './useTagSearch';
import { tagsApi } from '../../../lib/api/tags';

vi.mock('../../../lib/api/tags', () => ({
  tagsApi: {
    listTags: vi.fn(),
  },
}));

describe('useTagSearch', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('debounces API calls and returns mapped results', async () => {
    vi.useFakeTimers();
    vi.mocked(tagsApi.listTags).mockResolvedValue({
      tags: [
        {
          id: 't1',
          displayName: 'JavaScript',
          normalizedName: 'javascript',
          color: null,
          itemCount: 2,
          createdAt: '2026-02-15T00:00:00Z',
          updatedAt: '2026-02-15T00:00:00Z',
        },
      ],
      nextCursor: null,
      hasMore: false,
    });

    const { result } = renderHook(() => useTagSearch(300));

    act(() => {
      result.current.setQuery('java');
      vi.advanceTimersByTime(299);
    });

    expect(tagsApi.listTags).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await vi.runAllTimersAsync();
    });

    expect(tagsApi.listTags).toHaveBeenCalledWith('java', undefined, 25);
    expect(result.current.results[0]?.displayName).toBe('JavaScript');
  });
});
