import { CircleAlert, WifiOff } from 'lucide-react-native';

import { EmptyState } from '@/components/ui/EmptyState';

export type ErrorStateProps = {
  kind?: 'error' | 'offline';
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({ kind = 'error', message, onRetry }: ErrorStateProps) {
  if (kind === 'offline') {
    return (
      <EmptyState
        icon={WifiOff}
        title="You're offline"
        message={message ?? 'Check your connection and try again.'}
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  }
  return (
    <EmptyState
      icon={CircleAlert}
      title="That didn't work"
      message={message ?? 'Something went wrong. Try again?'}
      actionLabel="Retry"
      onAction={onRetry}
    />
  );
}
