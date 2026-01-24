import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './routes';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AuthGuard } from './components/auth/AuthGuard';
import { AuthErrorBoundary } from './components/auth/AuthErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthErrorBoundary>
        <AuthGuard>
          <RouterProvider router={router} />
        </AuthGuard>
      </AuthErrorBoundary>
      <Toaster richColors />
    </ErrorBoundary>
  );
}
