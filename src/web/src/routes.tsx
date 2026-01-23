import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { ItemsView } from './features/items/components/ItemsView';
import { Layout } from './components/layout/Layout';
import { useUiStore } from './stores/ui-store';
import { useCollectionsStore } from './features/collections/store';
import { useTagsStore } from './features/tags/store';

function CollectionView() {
  const { id } = useParams<{ id: string }>();
  const setViewState = useUiStore((state) => state.setViewState);
  const collections = useCollectionsStore((state) => state.collections);

  useEffect(() => {
    if (id) {
      // Find collection name from store for better title
      const collection = collections.find((c) => c.id === id);
      const title = collection?.name ?? 'Collection';
      setViewState({ type: 'collection', id, title });
    }
  }, [id, collections, setViewState]);

  return <ItemsView />;
}

function TagView() {
  const { name } = useParams<{ name: string }>();
  const setViewState = useUiStore((state) => state.setViewState);

  useEffect(() => {
    if (name) {
      // Decode URL-encoded tag name
      const decodedName = decodeURIComponent(name);
      setViewState({ type: 'tag', id: decodedName, title: `#${decodedName}` });
    }
  }, [name, setViewState]);

  return <ItemsView />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/inbox" replace /> },
      { path: 'inbox', element: <ItemsView /> },
      { path: 'favorites', element: <ItemsView /> },
      { path: 'archive', element: <ItemsView /> },
      { path: 'collections/:id', element: <CollectionView /> },
      { path: 'tags/:name', element: <TagView /> },
    ],
  },
]);
