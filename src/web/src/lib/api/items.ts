import { apiRequest, apiRequestWithResponse, buildQueryString } from './client';
import type {
  CreateItemRequest,
  ItemDto,
  ItemListParams,
  ItemListResponse,
  UpdateItemRequest,
} from './types';

export const itemsApi = {
  listItems: (params: ItemListParams = {}) =>
    apiRequest<ItemListResponse>(`/api/v1/items${buildQueryString(params)}`),
  getItem: (id: string) => apiRequest<ItemDto>(`/api/v1/items/${id}`),
  createItem: async (data: CreateItemRequest) => {
    const response = await apiRequestWithResponse<ItemDto>('/api/v1/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    return {
      item: response.data,
      created: response.status === 201,
    };
  },
  updateItem: (id: string, data: UpdateItemRequest) =>
    apiRequest<ItemDto>(`/api/v1/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteItem: (id: string) =>
    apiRequest<void>(`/api/v1/items/${id}`, {
      method: 'DELETE',
    }),
};
