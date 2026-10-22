import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 300_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => count < 1 && (!error.status || error.status >= 500),
        retryDelay: 1000,
      },
      mutations: { retry: false },
    },
  });
}
