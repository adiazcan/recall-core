import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useUiStore } from './stores/ui-store';
import { useCollectionsStore } from './features/collections/store';
import { LoadingState } from './components/common/LoadingState';

const Layout = lazy(() => import('./components/layout/Layout').then((m) => ({ default: m.Layout })));
const ItemsView = lazy(() => import('./features/items/components/ItemsView').then((m) => ({ default: m.ItemsView })));
const TagManagementPage = lazy(() => import('./pages/TagManagementPage').then((m) => ({ default: m.TagManagementPage })));

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
  const { id } = useParams<{ id: string }>();
  const setViewState = useUiStore((state) => state.setViewState);

  useEffect(() => {
    if (id) {
      setViewState({ type: 'tag', id, title: 'Tag' });
    }
  }, [id, setViewState]);

  return <ItemsView />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<LoadingState />}>
        <Layout />
      </Suspense>
    ),
    children: [
      { index: true, element: <Navigate to="/inbox" replace /> },
      {
        path: 'inbox',
        element: (
          <Suspense fallback={<LoadingState />}>
            <ItemsView />
          </Suspense>
        ),
      },
      {
        path: 'favorites',
        element: (
          <Suspense fallback={<LoadingState />}>
            <ItemsView />
          </Suspense>
        ),
      },
      {
        path: 'archive',
        element: (
          <Suspense fallback={<LoadingState />}>
            <ItemsView />
          </Suspense>
        ),
      },
      {
        path: 'collections/:id',
        element: (
          <Suspense fallback={<LoadingState />}>
            <CollectionView />
          </Suspense>
        ),
      },
      {
        path: 'tags/manage',
        element: (
          <Suspense fallback={<LoadingState />}>
            <TagManagementPage />
          </Suspense>
        ),
      },
      {
        path: 'tags/:id',
        element: (
          <Suspense fallback={<LoadingState />}>
            <TagView />
          </Suspense>
        ),
      },
    ],
  },
]);
