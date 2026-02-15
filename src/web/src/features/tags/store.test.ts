import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTagsStore } from './store';
import { tagsApi } from '../../lib/api/tags';

vi.mock('../../lib/api/tags', () => ({
  tagsApi: {
    listTags: vi.fn(),
    createTag: vi.fn(),
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
  },
}));

const tag = {
  id: 't1',
  displayName: 'JavaScript',
  normalizedName: 'javascript',
  color: null,
  itemCount: 1,
  createdAt: '2026-02-15T00:00:00Z',
  updatedAt: '2026-02-15T00:00:00Z',
};

describe('useTagsStore', () => {
  afterEach(() => {
    useTagsStore.setState({
      tags: new Map(),
      hasLoaded: false,
      isLoading: false,
      error: null,
      nextCursor: null,
      hasMore: false,
    });
    vi.clearAllMocks();
  });

  it('loads tags into map', async () => {
    vi.mocked(tagsApi.listTags).mockResolvedValue({ tags: [tag], nextCursor: null, hasMore: false });

    await useTagsStore.getState().listTags();

    expect(useTagsStore.getState().tags.get('t1')?.displayName).toBe('JavaScript');
  });

  it('supports create, update, delete', async () => {
    vi.mocked(tagsApi.createTag).mockResolvedValue(tag);
    vi.mocked(tagsApi.updateTag).mockResolvedValue({ ...tag, displayName: 'TypeScript', normalizedName: 'typescript' });
    vi.mocked(tagsApi.deleteTag).mockResolvedValue({ id: 't1', itemsUpdated: 0 });

    await useTagsStore.getState().createTag('JavaScript');
    expect(useTagsStore.getState().tags.has('t1')).toBe(true);

    await useTagsStore.getState().updateTag('t1', 'TypeScript');
    expect(useTagsStore.getState().tags.get('t1')?.displayName).toBe('TypeScript');

    await useTagsStore.getState().deleteTag('t1');
    expect(useTagsStore.getState().tags.has('t1')).toBe(false);
  });
});
