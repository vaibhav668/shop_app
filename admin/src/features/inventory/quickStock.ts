/**
 * Quick Stock state, kept free of React so it is easy to test. `base` is the count each row
 * was loaded with (what the server is told to expect); `draft` is what the shopkeeper typed.
 */
import type { BulkStockResult } from '@/api/inventory';

export type QuickRow = {
  id: string;
  name: string;
  unitLabel: string;
  base: number;
  draft: string;
  /** Set when the stock moved on the server (an order came in) while this row was being edited. */
  conflict: { current: number } | null;
  error: string | null;
};

const MAX_STOCK = 100_000;

export function parseStock(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n <= MAX_STOCK ? n : null;
}

export function isChanged(row: QuickRow): boolean {
  return row.draft.trim() !== String(row.base);
}

export function validateRows(rows: QuickRow[]): QuickRow[] {
  return rows.map((r) =>
    isChanged(r) && parseStock(r.draft) === null
      ? { ...r, error: 'Whole number, 0 or more' }
      : { ...r, error: null },
  );
}

export function toUpdates(rows: QuickRow[]) {
  return rows
    .filter((r) => isChanged(r) && parseStock(r.draft) !== null)
    .map((r) => ({ product_id: r.id, stock: parseStock(r.draft)!, expected_stock: r.base }));
}

/** Saved rows take the new count as their base; conflicting rows keep the draft and flag it. */
export function applyResult(rows: QuickRow[], result: BulkStockResult): QuickRow[] {
  const applied = new Map(result.applied.map((a) => [a.product_id, a.stock_quantity]));
  const conflicts = new Map(result.conflicts.map((c) => [c.product_id, c.current]));
  return rows.map((r) => {
    if (applied.has(r.id)) {
      const stock = applied.get(r.id)!;
      return { ...r, base: stock, draft: String(stock), conflict: null, error: null };
    }
    if (conflicts.has(r.id)) return { ...r, conflict: { current: conflicts.get(r.id)! } };
    return r;
  });
}

/** "Keep 24": save my number over the new one, so expect the current value next time. */
export function keepMine(row: QuickRow): QuickRow {
  return row.conflict ? { ...row, base: row.conflict.current, conflict: null } : row;
}

/** "Use 22": drop my edit and take the server's count. */
export function takeCurrent(row: QuickRow): QuickRow {
  return row.conflict
    ? { ...row, base: row.conflict.current, draft: String(row.conflict.current), conflict: null }
    : row;
}
