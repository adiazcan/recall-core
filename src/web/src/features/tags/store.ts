import { create } from 'zustand';
import type { Tag } from '../../types/entities';
import { tagsApi } from '../../lib/api/tags';
import { mapTagDtoToTag } from '../../lib/api/types';

export interface TagsState {
  tags: Map<string, Tag>;
  hasLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  nextCursor: string | null;
  hasMore: boolean;
  listTags: (q?: string, cursor?: string, limit?: number) => Promise<void>;
  createTag: (name: string, color?: string | null) => Promise<Tag | null>;
  updateTag: (id: string, name?: string, color?: string | null) => Promise<Tag | null>;
  deleteTag: (id: string) => Promise<void>;
}

export const useTagsStore = create<TagsState>((set, get) => ({
  tags: new Map<string, Tag>(),
  hasLoaded: false,
  isLoading: false,
  error: null,
  nextCursor: null,
  hasMore: false,
  listTags: async (q, cursor, limit) => {
    const { isLoading } = get();
    if (isLoading) {
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const response = await tagsApi.listTags(q, cursor, limit);
      const tags = response.tags.map(mapTagDtoToTag);
      const map = new Map(tags.map((tag) => [tag.id, tag]));
      set({
        tags: map,
        nextCursor: response.nextCursor,
        hasMore: response.hasMore,
        isLoading: false,
        hasLoaded: true,
      });
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load tags',
        isLoading: false,
        hasLoaded: true,
      });
    }
  },
  createTag: async (name, color) => {
    set({ error: null });
    try {
      const created = mapTagDtoToTag(await tagsApi.createTag(name, color));
      set((state) => {
        const nextTags = new Map(state.tags);
        nextTags.set(created.id, created);
        return { tags: nextTags };
      });
      return created;
    } catch (error) {
      console.error('Failed to create tag:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to create tag' });
      return null;
    }
  },
  updateTag: async (id, name, color) => {
    set({ error: null });
    try {
      const updated = mapTagDtoToTag(await tagsApi.updateTag(id, name, color));
      set((state) => {
        const nextTags = new Map(state.tags);
        nextTags.set(updated.id, updated);
        return { tags: nextTags };
      });
      return updated;
    } catch (error) {
      console.error('Failed to update tag:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update tag' });
      return null;
    }
  },
  deleteTag: async (id) => {
    set({ error: null });
    try {
      await tagsApi.deleteTag(id);
      set((state) => ({
        tags: new Map(Array.from(state.tags.entries()).filter(([tagId]) => tagId !== id)),
      }));
    } catch (error) {
      console.error('Failed to delete tag:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to delete tag' });
    }
  },
}));
