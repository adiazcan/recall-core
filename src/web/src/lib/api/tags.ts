import { apiRequest } from './client';
import type { RenameTagRequest, TagListResponse } from './types';

export const tagsApi = {
  list: () => apiRequest<TagListResponse>('/api/v1/tags'),
  rename: (name: string, data: RenameTagRequest) =>
    apiRequest<void>(`/api/v1/tags/${name}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (name: string) =>
    apiRequest<void>(`/api/v1/tags/${name}`, {
      method: 'DELETE',
    }),
};
