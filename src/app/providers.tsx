import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AnnounceProvider } from '@/app/announce';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <TooltipProvider delayDuration={250}>
          <AnnounceProvider>{children}</AnnounceProvider>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
