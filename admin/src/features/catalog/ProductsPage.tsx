import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Package, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import {
  ADMIN_PAGE_SIZE,
  type AdminProduct,
  adminCatalogApi,
  catalogKeys,
  type ProductStatus,
} from '@/api/catalog';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SelectField, TextField } from '@/components/form/Fields';
import { PageHeader } from '@/components/PageHeader';
import table from '@/components/Table.module.css';
import { formatPaise } from '@/lib/money';

import styles from './ProductsPage.module.css';

const STATUSES: { value: ProductStatus; label: string }[] = [
  { value: 'all', label: 'All (not archived)' },
  { value: 'active', label: 'Shown in app' },
  { value: 'inactive', label: 'Hidden' },
  { value: 'archived', label: 'Archived' },
];

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function ProductsPage() {
  const navigate = useNavigate();
  // Filters live in the URL so the page survives a refresh and can be bookmarked.
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as ProductStatus | null) ?? 'all';
  const categoryId = params.get('category') ?? '';
  const lowStock = params.get('low') === '1';
  const page = Math.max(0, Number(params.get('page') ?? 0));
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebounced(search.trim(), 300);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

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
    status,
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
  const filtered = Boolean(q || categoryId || lowStock || status !== 'all');

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything the shop sells. Prices and stock here are what customers see."
        actions={
          <Button onClick={() => navigate('/products/new')}>
            <Plus size={16} aria-hidden /> Add product
          </Button>
        }
      />

      <div className={styles.filters}>
        <TextField
          label="Search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name or keyword, e.g. doodh"
        />
        <SelectField
          label="Category"
          value={categoryId}
          onChange={(e) => update({ category: e.target.value || null })}
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Status"
          value={status}
          onChange={(e) => update({ status: e.target.value === 'all' ? null : e.target.value })}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <label className={styles.lowStock}>
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => update({ low: e.target.checked ? '1' : null })}
          />
          Low stock only
        </label>
      </div>

      {products.isError ? (
        <EmptyState
          icon={Package}
          title="Couldn't load products"
          action={
            <Button variant="secondary" onClick={() => products.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !products.isPending && total === 0 ? (
        filtered ? (
          <EmptyState icon={Package} title="No products match these filters." />
        ) : (
          <EmptyState
            icon={Package}
            title="Nothing here yet."
            message="Add your first product with a photo, price and stock."
            action={<Button onClick={() => navigate('/products/new')}>Add product</Button>}
          />
        )
      ) : (
        <div className={table.panel} aria-busy={products.isFetching || undefined}>
          <table className={table.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th className={table.num}>Price</th>
                <th className={table.num}>Stock</th>
                <th>Status</th>
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
                : items.map((p) => <ProductRow key={p.id} product={p} />)}
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
                onClick={() => update({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={to >= total}
                onClick={() => update({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProductRow({ product: p }: { product: AdminProduct }) {
  return (
    <tr>
      <td>
        <div className={table.nameCell}>
          <span className={table.thumb}>
            {p.image_url ? <img src={p.image_url} alt="" /> : <Package size={18} />}
          </span>
          <span>
            <Link to={`/products/${p.id}`} className={table.primary}>
              {p.name}
            </Link>
            <br />
            <span className={table.secondary}>{p.unit_label}</span>
          </span>
        </div>
      </td>
      <td className={table.secondary}>{p.category_name}</td>
      <td className={table.num}>
        {formatPaise(p.price_paise)}
        {p.mrp_paise > p.price_paise ? (
          <>
            <br />
            <span className={table.strike}>{formatPaise(p.mrp_paise)}</span>
          </>
        ) : null}
      </td>
      <td className={table.num}>
        <span
          className={`${table.stock} ${p.stock_quantity === 0 ? table.zero : ''}`}
          title={p.is_low_stock ? 'Low stock' : undefined}
        >
          {p.is_low_stock && p.stock_quantity > 0 ? (
            <span className={table.lowDot} aria-label="Low stock" />
          ) : null}
          {p.stock_quantity}
        </span>
      </td>
      <td>
        {p.archived_at ? (
          <Badge tone="neutral">Archived</Badge>
        ) : !p.is_active ? (
          <Badge tone="neutral">Hidden</Badge>
        ) : p.stock_quantity === 0 ? (
          <Badge tone="danger">Out of stock</Badge>
        ) : (
          <Badge tone="success">Shown</Badge>
        )}
      </td>
    </tr>
  );
}
