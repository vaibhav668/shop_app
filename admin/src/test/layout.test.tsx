import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { NAV_ITEMS } from '@/navigation';
import { routes } from '@/routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('admin shell', () => {
  it('lists every section in the sidebar, in order', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(NAV_ITEMS.map((item) => item.label));
  });

  it('marks only the current section as active', () => {
    renderAt('/inventory');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Inventory' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('navigates between sections', async () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Orders' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument();
  });

  it('shows a friendly page for unknown URLs', () => {
    renderAt('/nope');
    expect(screen.getByText("This page doesn't exist.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/');
  });
});
