import { ApiError } from '@/api/client';
import { ErrorState } from '@/components/ui';

/** The standard failed-to-load state: "offline" for network errors, otherwise a generic retry. */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const offline = error instanceof ApiError && error.isNetworkError;
  return <ErrorState kind={offline ? 'offline' : 'error'} onRetry={onRetry} />;
}
