import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRoutes } from '@/app/router';
import { AuthProvider } from '@/app/AuthProvider';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { Providers } from '@/app/providers';
import '@fontsource/lato/latin-400.css';
import '@fontsource/lato/latin-700.css';
import '@fontsource/raleway/latin-600.css';
import '@fontsource/raleway/latin-700.css';
import '@/styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <Providers>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Providers>
    </ErrorBoundary>
  </StrictMode>,
);
