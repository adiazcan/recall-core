import { apiRequest, apiRequestWithResponse, buildQueryString } from './client';
import type {
  CreateItemRequest,
  ItemDto,
  ItemListParams,
  ItemListResponse,
  UpdateItemRequest,
} from './types';

export const itemsApi = {
  list: (params: ItemListParams = {}) =>
    apiRequest<ItemListResponse>(`/api/v1/items${buildQueryString(params)}`),
  get: (id: string) => apiRequest<ItemDto>(`/api/v1/items/${id}`),
  create: async (data: CreateItemRequest) => {
    const response = await apiRequestWithResponse<ItemDto>('/api/v1/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    return {
      item: response.data,
      created: response.status === 201,
    };
  },
  update: (id: string, data: UpdateItemRequest) =>
    apiRequest<ItemDto>(`/api/v1/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    apiRequest<void>(`/api/v1/items/${id}`, {
      method: 'DELETE',
    }),
};
