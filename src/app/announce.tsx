import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const AnnounceContext = createContext<(message: string) => void>(() => {});

export function AnnounceProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const announce = useCallback((next: string) => {
    setMessage('');
    window.setTimeout(() => setMessage(next), 30);
  }, []);
  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {message}
      </div>
    </AnnounceContext.Provider>
  );
}

export function useAnnounce() {
  return useContext(AnnounceContext);
}
