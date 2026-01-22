import { createBrowserRouter, Navigate } from 'react-router-dom';
import { EmptyState } from './components/common/EmptyState';
import { ItemsView } from './features/items/components/ItemsView';
import { Layout } from './components/layout/Layout';

function PlaceholderView({ title }: { title: string }) {
  return (
    <EmptyState
      title={title}
      description="This view will be wired to live data in the next phase."
    />
  );
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
      { path: 'collections/:id', element: <PlaceholderView title="Collection" /> },
      { path: 'tags/:name', element: <PlaceholderView title="Tag" /> },
    ],
  },
]);
