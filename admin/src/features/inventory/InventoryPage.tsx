import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, History, Minus, Package, Plus, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { ADMIN_PAGE_SIZE, type AdminProduct, adminCatalogApi, catalogKeys } from '@/api/catalog';
import { ApiError } from '@/api/client';
import { inventoryApi } from '@/api/inventory';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SelectField, TextField } from '@/components/form/Fields';
import { PageHeader } from '@/components/PageHeader';
import table from '@/components/Table.module.css';

import { MovementsDrawer } from './MovementsDrawer';

import styles from './InventoryPage.module.css';

export function InventoryPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const categoryId = params.get('category') ?? '';
  const lowStock = params.get('low') === '1';
  const page = Math.max(0, Number(params.get('page') ?? 0));
  const historyFor = params.get('history');
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebounced(search.trim(), 300);

  const set = (changes: Record<string, string | null>, keepPage = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (!keepPage && !('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );

  useEffect(() => {
    setParams(
      (prev) => {
        if ((prev.get('q') ?? '') === q) return prev;
        const next = new URLSearchParams(prev);
        if (q) next.set('q', q);
        else next.delete('q');
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  }, [q, setParams]);

  const filters = {
    q: q || undefined,
    categoryId: categoryId || undefined,
    status: 'all' as const,
    lowStock,
    offset: page * ADMIN_PAGE_SIZE,
  };
  const products = useQuery({
    queryKey: catalogKeys.products(filters),
    queryFn: () => adminCatalogApi.products(filters),
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({
    queryKey: catalogKeys.categories,
    queryFn: adminCatalogApi.categories,
  });

  const total = products.data?.total ?? 0;
  const items = products.data?.items ?? [];
  const from = total === 0 ? 0 : page * ADMIN_PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * ADMIN_PAGE_SIZE);
  const historyProduct = items.find((p) => p.id === historyFor);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock counts customers can buy right now. Orders take stock off automatically."
        actions={
          <Button
            onClick={() =>
              navigate(categoryId ? `/inventory/quick?category=${categoryId}` : '/inventory/quick')
            }
          >
            <Zap size={16} aria-hidden /> Quick Stock
          </Button>
        }
      />

      <div className={styles.filters}>
        <TextField
          label="Search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Product name"
        />
        <SelectField
          label="Category"
          value={categoryId}
          onChange={(e) => set({ category: e.target.value || null })}
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => set({ low: e.target.checked ? '1' : null })}
          />
          Low stock only
        </label>
      </div>

      {products.isError ? (
        <EmptyState
          icon={Boxes}
          title="Couldn't load inventory"
          action={
            <Button variant="secondary" onClick={() => products.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !products.isPending && total === 0 ? (
        <EmptyState
          icon={Boxes}
          title={lowStock ? 'Nothing is running low.' : 'No products match these filters.'}
        />
      ) : (
        <div className={table.panel} aria-busy={products.isFetching || undefined}>
          <table className={table.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th className={table.num}>In stock</th>
                <th>Shown in app</th>
                <th aria-label="History" />
              </tr>
            </thead>
            <tbody>
              {products.isPending
                ? Array.from({ length: 6 }, (_, i) => (
                    <tr key={i} className={table.loadingRow}>
                      <td colSpan={5}>
                        <span
                          className={table.skeleton}
                          style={{ width: `${40 + (i % 3) * 15}%` }}
                        />
                      </td>
                    </tr>
                  ))
                : items.map((p) => (
                    <InventoryRow
                      // Re-keyed on the server's count so the input resets after a save.
                      key={`${p.id}:${p.stock_quantity}`}
                      product={p}
                      onHistory={() => set({ history: p.id }, true)}
                    />
                  ))}
            </tbody>
          </table>
          <div className={table.footer}>
            <span className="tabular">
              {from}–{to} of {total}
            </span>
            <div className={table.pager}>
              <Button
                variant="secondary"
                disabled={page === 0}
                onClick={() => set({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={to >= total}
                onClick={() => set({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {historyFor ? (
        <MovementsDrawer
          productId={historyFor}
          productName={historyProduct?.name}
          onClose={() => set({ history: null }, true)}
        />
      ) : null}
    </>
  );
}

function InventoryRow({ product: p, onHistory }: { product: AdminProduct; onHistory: () => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(String(p.stock_quantity));
  const [message, setMessage] = useState<string | null>(null);
  const archived = !!p.archived_at;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: catalogKeys.allProducts }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'inventory', 'movements', p.id] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
    ]);
  const fail = (e: unknown) => {
    setMessage(e instanceof ApiError ? e.message : "Couldn't save. Try again?");
    void refresh();
  };

  const adjust = useMutation({
    mutationFn: (delta: number) => inventoryApi.adjust(p.id, delta),
    onSuccess: refresh,
    onError: fail,
  });
  const setStock = useMutation({
    // Sends the count this row showed: if an order changed it meanwhile, the server says so.
    mutationFn: (stock: number) => adminCatalogApi.setStock(p.id, stock, p.stock_quantity),
    onSuccess: refresh,
    onError: fail,
  });
  const visibility = useMutation({
    mutationFn: (isActive: boolean) => adminCatalogApi.updateProduct(p.id, { is_active: isActive }),
    onSuccess: refresh,
    onError: fail,
  });
  const busy = adjust.isPending || setStock.isPending;

  const commit = () => {
    const value = draft.trim();
    if (value === String(p.stock_quantity)) return;
    if (!/^\d+$/.test(value) || Number(value) > 100_000) {
      setMessage('Enter a whole number, 0 or more.');
      return;
    }
    setMessage(null);
    setStock.mutate(Number(value));
  };

  return (
    <tr className={archived ? styles.archived : undefined}>
      <td>
        <div className={table.nameCell}>
          <span className={table.thumb}>
            {p.image_url ? <img src={p.image_url} alt="" /> : <Package size={18} />}
          </span>
          <span>
            <span className={table.primary}>{p.name}</span>
            <br />
            <span className={table.secondary}>
              {p.unit_label}
              {archived ? ' · archived' : ''}
            </span>
          </span>
        </div>
      </td>
      <td className={table.secondary}>{p.category_name}</td>
      <td className={table.num}>
        <div className={styles.stepper}>
          {p.is_low_stock ? (
            <span
              className={`${styles.flag} ${p.stock_quantity === 0 ? styles.out : ''}`}
              title={p.stock_quantity === 0 ? 'Out of stock' : 'Low stock'}
            >
              {p.stock_quantity === 0 ? 'Out' : 'Low'}
            </span>
          ) : null}
          <button
            type="button"
            className={table.iconButton}
            aria-label={`Remove one ${p.name}`}
            disabled={busy || p.stock_quantity === 0}
            onClick={() => adjust.mutate(-1)}
          >
            <Minus size={16} aria-hidden />
          </button>
          <input
            className={styles.count}
            inputMode="numeric"
            aria-label={`Stock for ${p.name}`}
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setDraft(String(p.stock_quantity));
                setMessage(null);
              }
            }}
          />
          <button
            type="button"
            className={table.iconButton}
            aria-label={`Add one ${p.name}`}
            disabled={busy}
            onClick={() => adjust.mutate(1)}
          >
            <Plus size={16} aria-hidden />
          </button>
        </div>
        {message ? <div className={styles.message}>{message}</div> : null}
      </td>
      <td>
        <label className={styles.switch}>
          <input
            type="checkbox"
            role="switch"
            aria-label={`Show ${p.name} in app`}
            checked={p.is_active}
            disabled={archived || visibility.isPending}
            onChange={(e) => visibility.mutate(e.target.checked)}
          />
        </label>
      </td>
      <td className={table.num}>
        <button
          type="button"
          className={table.iconButton}
          aria-label={`Stock history for ${p.name}`}
          title="Stock history"
          onClick={onHistory}
        >
          <History size={16} aria-hidden />
        </button>
      </td>
    </tr>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
