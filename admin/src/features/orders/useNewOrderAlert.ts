import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { ordersApi, ordersKeys } from '@/api/orders';

export const POLL_MS = 15_000;
const BASE_TITLE = 'Bada Bazar · Admin';

/**
 * While the admin is open: polls for new orders every 15 s, plays a chime when one arrives,
 * refreshes the order lists, and shows the count of orders waiting in the tab title.
 * Returns how many orders are waiting to be accepted.
 */
export function useNewOrderAlert(): number {
  const queryClient = useQueryClient();
  const summary = useQuery({
    queryKey: ordersKeys.summary,
    queryFn: ordersApi.summary,
    refetchInterval: POLL_MS,
    // Keep listening in a background tab: that's exactly when the chime matters.
    refetchIntervalInBackground: true,
  });
  // undefined = not loaded yet, so the orders already waiting at sign-in don't chime.
  const lastSeen = useRef<string | null | undefined>(undefined);

  const latest = summary.data?.latest_order_at;
  useEffect(() => {
    if (latest === undefined) return;
    if (isNewer(latest, lastSeen.current)) {
      playChime();
      void queryClient.invalidateQueries({ queryKey: ordersKeys.lists });
      void queryClient.invalidateQueries({ queryKey: ordersKeys.dashboard });
    }
    lastSeen.current = latest;
  }, [latest, queryClient]);

  const pending = summary.data?.pending_count ?? 0;
  useEffect(() => {
    document.title = pending > 0 ? `(${pending}) ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [pending]);

  return pending;
}

export function isNewer(latest: string | null, seen: string | null | undefined): boolean {
  if (seen === undefined || latest === null) return false;
  return seen === null || new Date(latest) > new Date(seen);
}

/** A soft two-note chime made on the fly (no audio file to ship). Silently skipped if the
 *  browser blocks sound until the page has been clicked. */
function playChime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [880, 1318.5]; // A5 then E6
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // No sound is fine; the badge and title still show the new order.
  }
}
