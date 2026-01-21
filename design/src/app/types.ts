export type ItemType = 'article' | 'video' | 'tweet';

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Collection {
  id: string;
  name: string;
  icon?: string;
  count: number;
}

export interface Item {
  id: string;
  title: string;
  url: string;
  domain: string;
  excerpt?: string;
  imageUrl?: string;
  tags: string[]; // Tag IDs
  collectionId?: string;
  isFavorite: boolean;
  isArchived: boolean;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
  type: ItemType;
}

export type ViewType = 'inbox' | 'favorites' | 'archive' | 'collection' | 'tag';

export interface ViewState {
  type: ViewType;
  id?: string; // Collection ID or Tag ID if applicable
  title: string;
}
