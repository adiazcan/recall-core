import { apiRequest } from './client';
import type {
  CreateTagRequest,
  TagDeleteResponse,
  TagDto,
  TagListResponse,
  UpdateTagRequest,
} from './types';

export const tagsApi = {
  createTag: (name: string, color?: string | null) =>
    apiRequest<TagDto>('/api/v1/tags', {
      method: 'POST',
      body: JSON.stringify({ name, color } satisfies CreateTagRequest),
    }),
  listTags: (q?: string, cursor?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (cursor) params.set('cursor', cursor);
    if (typeof limit === 'number') params.set('limit', String(limit));

    const query = params.toString();
    return apiRequest<TagListResponse>(`/api/v1/tags${query ? `?${query}` : ''}`);
  },
  getTag: (id: string) => apiRequest<TagDto>(`/api/v1/tags/${id}`),
  updateTag: (id: string, name?: string, color?: string | null) =>
    apiRequest<TagDto>(`/api/v1/tags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, color } satisfies UpdateTagRequest),
    }),
  deleteTag: (id: string) =>
    apiRequest<TagDeleteResponse>(`/api/v1/tags/${id}`, {
      method: 'DELETE',
    }),
};
