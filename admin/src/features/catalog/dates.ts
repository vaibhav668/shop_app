const pad = (n: number) => String(n).padStart(2, '0');

/** ISO timestamp → value for <input type="datetime-local"> in the browser's timezone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (browser timezone) → ISO timestamp, or null if empty. */
export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}
