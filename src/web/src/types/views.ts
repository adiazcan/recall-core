import type { ItemStatus } from './entities';

export type ViewType = 'inbox' | 'favorites' | 'archive' | 'collection' | 'tag';

export interface ViewState {
  type: ViewType;
  id?: string;
  title: string;
}

export const DEFAULT_VIEWS = {
  inbox: { type: 'inbox', title: 'Inbox' },
  favorites: { type: 'favorites', title: 'Favorites' },
  archive: { type: 'archive', title: 'Archive' },
} as const satisfies Record<string, ViewState>;

export interface ItemFilterParams {
  status?: ItemStatus;
  collectionId?: string;
  tagId?: string;
  isFavorite?: boolean;
  cursor?: string;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

export function viewStateToFilterParams(view: ViewState): ItemFilterParams {
  switch (view.type) {
    case 'inbox':
      return { status: 'unread' };
    case 'favorites':
      return { isFavorite: true };
    case 'archive':
      return { status: 'archived' };
    case 'collection':
      return { collectionId: view.id };
    case 'tag':
      return { tagId: view.id };
    default:
      return {};
  }
}
