import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './routes';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AuthGuard } from './components/auth/AuthGuard';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthGuard>
        <RouterProvider router={router} />
      </AuthGuard>
      <Toaster richColors />
    </ErrorBoundary>
  );
}
