import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { NAV_ITEMS } from '@/navigation';

import { authOk, mockApi, renderApp } from './renderApp';

beforeEach(() => {
  mockApi({ '/auth/refresh': authOk() });
});

describe('admin shell (signed in)', () => {
  it('lists every section in the sidebar, in order', async () => {
    renderApp('/');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(NAV_ITEMS.map((item) => item.label));
  });

  it('marks only the current section as active', async () => {
    renderApp('/inventory');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Inventory' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('navigates between sections', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Orders' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument();
  });

  it('shows the signed-in admin', async () => {
    renderApp('/');
    expect(await screen.findByText('Meena Shah')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
  });

  it('opens the phone menu from the top bar and closes it after choosing a section', async () => {
    renderApp('/');
    const menuButton = await screen.findByRole('button', { name: 'Open menu' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    const nav = screen.getByRole('navigation', { name: 'Main' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Orders' }));
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument();
  });

  it('shows a friendly page for unknown URLs', async () => {
    renderApp('/nope');
    expect(await screen.findByText("This page doesn't exist.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/');
  });
});
