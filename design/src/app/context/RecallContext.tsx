import React, { createContext, useContext, useState, useMemo } from 'react';
import { Item, Tag, Collection, ViewState, ViewType } from '../types';
import { MOCK_ITEMS, MOCK_TAGS, MOCK_COLLECTIONS } from '../mockData';
import { v4 as uuidv4 } from 'uuid';

interface RecallContextType {
  items: Item[];
  tags: Tag[];
  collections: Collection[];
  viewState: ViewState;
  setViewState: (view: ViewState) => void;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  toggleFavorite: (id: string) => void;
  toggleArchive: (id: string) => void;
  deleteItem: (id: string) => void;
  addItem: (url: string) => void;
  getFilteredItems: () => Item[];
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
}

const RecallContext = createContext<RecallContextType | undefined>(undefined);

export const RecallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<Item[]>(MOCK_ITEMS);
  const [tags, setTags] = useState<Tag[]>(MOCK_TAGS);
  const [collections, setCollections] = useState<Collection[]>(MOCK_COLLECTIONS);
  const [viewState, setViewState] = useState<ViewState>({ type: 'inbox', title: 'Inbox' });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const toggleFavorite = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
    ));
  };

  const toggleArchive = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, isArchived: !item.isArchived } : item
    ));
  };


  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    if (selectedItemId === id) setSelectedItemId(null);
  };

  const addItem = (url: string) => {
    const newItem: Item = {
      id: uuidv4(),
      title: 'New Saved Item',
      url,
      domain: new URL(url).hostname,
      tags: [],
      isFavorite: false,
      isArchived: false,
      isRead: false,
      createdAt: new Date(),
      type: 'article',
    };
    setItems(prev => [newItem, ...prev]);
  };

  const getFilteredItems = useMemo(() => {
    return () => {
      let filtered = items;

      // First, filter by main view type
      if (viewState.type === 'inbox') {
        filtered = filtered.filter(i => !i.isArchived);
      } else if (viewState.type === 'favorites') {
        filtered = filtered.filter(i => i.isFavorite && !i.isArchived);
      } else if (viewState.type === 'archive') {
        filtered = filtered.filter(i => i.isArchived);
      } else if (viewState.type === 'collection') {
        filtered = filtered.filter(i => i.collectionId === viewState.id && !i.isArchived);
      } else if (viewState.type === 'tag') {
        filtered = filtered.filter(i => i.tags.includes(viewState.id!) && !i.isArchived);
      }

      return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    };
  }, [items, viewState]);

  return (
    <RecallContext.Provider value={{
      items,
      tags,
      collections,
      viewState,
      setViewState,
      selectedItemId,
      setSelectedItemId,
      toggleFavorite,
      toggleArchive,
      deleteItem,
      addItem,
      getFilteredItems,
      isMobileSidebarOpen,
      setMobileSidebarOpen
    }}>
      {children}
    </RecallContext.Provider>
  );
};

export const useRecall = () => {
  const context = useContext(RecallContext);
  if (!context) {
    throw new Error('useRecall must be used within a RecallProvider');
  }
  return context;
};
