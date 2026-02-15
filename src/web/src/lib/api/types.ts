import type { Collection, Item, ItemStatus, Tag, TagSummary } from '../../types/entities';
import { extractDomain } from '../utils';

export type EnrichmentStatus = 'pending' | 'succeeded' | 'failed';

export interface ItemDto {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string | null;
  excerpt: string | null;
  thumbnailUrl?: string | null;
  previewImageUrl?: string | null;
  enrichmentStatus: EnrichmentStatus;
  enrichmentError?: string | null;
  enrichedAt?: string | null;
  status: ItemStatus;
  isFavorite: boolean;
  collectionId: string | null;
  tags: TagSummaryDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ItemListResponse {
  items: ItemDto[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ItemListParams {
  status?: ItemStatus;
  collectionId?: string;
  tagId?: string;
  isFavorite?: boolean;
  cursor?: string;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface CreateItemRequest {
  url: string;
  title?: string | null;
}

export interface UpdateItemRequest {
  title?: string | null;
  excerpt?: string | null;
  status?: ItemStatus | null;
  isFavorite?: boolean | null;
  collectionId?: string | null;
  tagIds?: string[] | null;
  newTagNames?: string[] | null;
}

export interface CollectionDto {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionListResponse {
  collections: CollectionDto[];
}

export interface CreateCollectionRequest {
  name: string;
  description?: string | null;
  parentId?: string | null;
}

export interface UpdateCollectionRequest {
  name?: string | null;
  description?: string | null;
  parentId?: string | null;
}

export interface TagDto {
  id: string;
  displayName: string;
  normalizedName: string;
  color: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TagListResponse {
  tags: TagDto[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface TagSummaryDto {
  id: string;
  name: string;
  color: string | null;
}

export interface CreateTagRequest {
  name: string;
  color?: string | null;
}

export interface UpdateTagRequest {
  name?: string;
  color?: string | null;
}

export interface TagDeleteResponse {
  id: string;
  itemsUpdated: number;
}

export function mapItemDtoToItem(dto: ItemDto): Item {
  return {
    id: dto.id,
    url: dto.url,
    normalizedUrl: dto.normalizedUrl,
    title: dto.title,
    excerpt: dto.excerpt,
    imageUrl: dto.previewImageUrl ?? dto.thumbnailUrl ?? undefined,
    domain: extractDomain(dto.url),
    collectionId: dto.collectionId,
    tags: dto.tags.map((tag): TagSummary => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    })),
    status: dto.status,
    isFavorite: dto.isFavorite,
    isArchived: dto.status === 'archived',
    isRead: dto.status !== 'unread',
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapCollectionDtoToCollection(dto: CollectionDto): Collection {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    parentId: dto.parentId,
    itemCount: dto.itemCount,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export function mapTagDtoToTag(dto: TagDto): Tag {
  return {
    id: dto.id,
    displayName: dto.displayName,
    normalizedName: dto.normalizedName,
    color: dto.color,
    itemCount: dto.itemCount,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}
