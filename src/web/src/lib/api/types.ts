import type { Collection, Item, ItemStatus, Tag } from '../../types/entities';
import { extractDomain } from '../utils';

export interface ItemDto {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string | null;
  excerpt: string | null;
  status: ItemStatus;
  isFavorite: boolean;
  collectionId: string | null;
  tags: string[];
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
  tag?: string;
  isFavorite?: boolean;
  cursor?: string;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface CreateItemRequest {
  url: string;
  title?: string | null;
  tags?: string[] | null;
}

export interface UpdateItemRequest {
  title?: string | null;
  excerpt?: string | null;
  status?: ItemStatus | null;
  isFavorite?: boolean | null;
  collectionId?: string | null;
  tags?: string[] | null;
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
  name: string;
  count: number;
}

export interface TagListResponse {
  tags: TagDto[];
}

export interface RenameTagRequest {
  newName: string;
}

const TAG_COLORS = [
  'bg-orange-100 text-orange-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-yellow-100 text-yellow-700',
  'bg-cyan-100 text-cyan-700',
  'bg-red-100 text-red-700',
] as const;

function getTagColor(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TAG_COLORS[hash % TAG_COLORS.length];
}

export function mapItemDtoToItem(dto: ItemDto): Item {
  return {
    id: dto.id,
    url: dto.url,
    normalizedUrl: dto.normalizedUrl,
    title: dto.title,
    excerpt: dto.excerpt,
    domain: extractDomain(dto.url),
    collectionId: dto.collectionId,
    tags: dto.tags,
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
    name: dto.name,
    count: dto.count,
    color: getTagColor(dto.name),
  };
}
