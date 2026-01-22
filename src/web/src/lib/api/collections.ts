import { apiRequest, buildQueryString } from './client';
import type {
  CollectionDto,
  CollectionListResponse,
  CreateCollectionRequest,
  UpdateCollectionRequest,
} from './types';

export type CollectionDeleteMode = 'default' | 'cascade';

export const collectionsApi = {
  list: () => apiRequest<CollectionListResponse>('/api/v1/collections'),
  get: (id: string) => apiRequest<CollectionDto>(`/api/v1/collections/${id}`),
  create: (data: CreateCollectionRequest) =>
    apiRequest<CollectionDto>('/api/v1/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UpdateCollectionRequest) =>
    apiRequest<CollectionDto>(`/api/v1/collections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string, mode?: CollectionDeleteMode) =>
    apiRequest<void>(`/api/v1/collections/${id}${buildQueryString({ mode })}`, {
      method: 'DELETE',
    }),
};
