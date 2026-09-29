import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Boxes } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useSearchParams } from 'react-router';

import { adminCatalogApi, catalogKeys } from '@/api/catalog';
import { ApiError } from '@/api/client';
import { inventoryApi, inventoryKeys } from '@/api/inventory';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { SelectField } from '@/components/form/Fields';
import { PageHeader } from '@/components/PageHeader';

import {
  applyResult,
  isChanged,
  keepMine,
  type QuickRow,
  takeCurrent,
  toUpdates,
  validateRows,
} from './quickStock';

import styles from './QuickStockPage.module.css';

/** A dense count sheet: type the new numbers top to bottom, then save once. */
export function QuickStockPage() {
  const [params, setParams] = useSearchParams();
  const categoryId = params.get('category') ?? '';
  const filters = { categoryId: categoryId || undefined, status: 'all' as const };

  const categories = useQuery({
    queryKey: catalogKeys.categories,
    queryFn: adminCatalogApi.categories,
  });
  const products = useQuery({
    queryKey: inventoryKeys.quick(filters),
    queryFn: () => inventoryApi.allProducts(filters),
    // A count sheet must not reshuffle under the shopkeeper's fingers.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  return (
    <>
      <Link to="/inventory" className={styles.back}>
        <ArrowLeft size={16} aria-hidden /> Inventory
      </Link>
      <PageHeader
        title="Quick Stock"
        description="Type the counts you see on the shelf. Enter or ↓ moves to the next item."
      />
      <div className={styles.filters}>
        <SelectField
          label="Category"
          value={categoryId}
          onChange={(e) =>
            setParams(e.target.value ? { category: e.target.value } : {}, { replace: true })
          }
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      </div>

      {products.isPending ? (
        <FullPageSpinner />
      ) : products.isError ? (
        <EmptyState
          icon={Boxes}
          title="Couldn't load products"
          action={
            <Button variant="secondary" onClick={() => products.refetch()}>
              Retry
            </Button>
          }
        />
      ) : products.data.length === 0 ? (
        <EmptyState icon={Boxes} title="No products in this category." />
      ) : (
        <Sheet
          key={categoryId}
          initial={products.data.map((p) => ({
            id: p.id,
            name: p.name,
            unitLabel: p.unit_label,
            base: p.stock_quantity,
            draft: String(p.stock_quantity),
            conflict: null,
            error: null,
          }))}
        />
      )}
    </>
  );
}

function Sheet({ initial }: { initial: QuickRow[] }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const changed = rows.filter(isChanged).length;
  const conflicts = rows.filter((r) => r.conflict).length;

  // Leaving with unsaved counts asks first (in-app navigation and closing the tab).
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      changed > 0 && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (
      window.confirm(
        `You have ${changed} unsaved ${changed === 1 ? 'change' : 'changes'}. Leave anyway?`,
      )
    ) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker, changed]);
  useEffect(() => {
    if (changed === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changed]);

  const update = (id: string, fn: (r: QuickRow) => QuickRow) =>
    setRows((all) => all.map((r) => (r.id === id ? fn(r) : r)));

  const save = useMutation({
    mutationFn: (updates: ReturnType<typeof toUpdates>) => inventoryApi.bulk(updates),
    onSuccess: (result) => {
      setRows((all) => applyResult(all, result));
      void queryClient.invalidateQueries({ queryKey: catalogKeys.allProducts });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      setNotice(
        result.conflicts.length
          ? `Saved ${result.applied.length}. ${result.conflicts.length} changed while you were counting; choose below.`
          : `Saved ${result.applied.length} ${result.applied.length === 1 ? 'count' : 'counts'}.`,
      );
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't save. Try again?"),
  });

  const submit = () => {
    setNotice(null);
    setError(null);
    const checked = validateRows(rows);
    setRows(checked);
    if (checked.some((r) => r.error)) {
      setError('Fix the highlighted counts.');
      return;
    }
    const updates = toUpdates(checked);
    if (updates.length) save.mutate(updates);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    const move = e.key === 'Enter' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!move) return;
    e.preventDefault();
    const next = inputs.current[index + move];
    next?.focus();
    next?.select();
  };

  return (
    <>
      <div className={styles.bar} role="status">
        <span className={styles.count}>
          {changed === 0 ? 'No changes yet' : `${changed} ${changed === 1 ? 'change' : 'changes'}`}
          {conflicts ? ` · ${conflicts} to review` : ''}
        </span>
        <Button onClick={submit} loading={save.isPending} disabled={changed === 0}>
          Save {changed || ''}
        </Button>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {notice ? <p className={styles.notice}>{notice}</p> : null}

      <ol className={styles.sheet}>
        {rows.map((row, index) => (
          <li
            key={row.id}
            className={`${styles.row} ${isChanged(row) ? styles.changed : ''} ${
              row.conflict ? styles.conflictRow : ''
            }`}
          >
            <span className={styles.name}>
              {row.name}
              <span className={styles.unit}> · {row.unitLabel}</span>
            </span>
            <span className={styles.was}>{isChanged(row) ? `was ${row.base}` : ''}</span>
            <input
              ref={(el) => {
                inputs.current[index] = el;
              }}
              className={styles.input}
              inputMode="numeric"
              aria-label={`Stock for ${row.name}`}
              aria-invalid={row.error ? true : undefined}
              value={row.draft}
              onChange={(e) =>
                update(row.id, (r) => ({ ...r, draft: e.target.value, error: null }))
              }
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => onKeyDown(e, index)}
            />
            {row.conflict ? (
              <span className={styles.conflict}>
                Changed {row.base} → {row.conflict.current} (probably an order).
                <button type="button" onClick={() => update(row.id, keepMine)}>
                  Keep {row.draft}
                </button>
                <button type="button" onClick={() => update(row.id, takeCurrent)}>
                  Use {row.conflict.current}
                </button>
              </span>
            ) : row.error ? (
              <span className={styles.error}>{row.error}</span>
            ) : null}
          </li>
        ))}
      </ol>
    </>
  );
}
