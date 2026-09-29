import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import type { NavItem } from '@/navigation';

/** Stand-in for a section until its real page is built in a later phase. */
export function SectionPlaceholder({ item }: { item: NavItem }) {
  return (
    <>
      <PageHeader title={item.label} />
      <EmptyState icon={item.icon} title="Nothing here yet." message={item.description} />
    </>
  );
}
