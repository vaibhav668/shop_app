import { SearchX } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/EmptyState';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={SearchX}
      title="This page doesn't exist."
      message="The link may be old or mistyped."
      action={<Link to="/">Back to dashboard</Link>}
    />
  );
}
