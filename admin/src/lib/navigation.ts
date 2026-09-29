/** Leaves the admin for another site (a wrapper so tests can observe it). */
export function goTo(url: string): void {
  window.location.assign(url);
}
