export type ItemStatus = 'unread' | 'archived';

export interface Item {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string | null;
  excerpt: string | null;
  domain: string;
  imageUrl?: string;
  collectionId: string | null;
  tags: TagSummary[];
  status: ItemStatus;
  isFavorite: boolean;
  isArchived: boolean;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TagSummary {
  id: string;
  name: string;
  color: string | null;
}

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: string;
  displayName: string;
  normalizedName: string;
  color: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}
