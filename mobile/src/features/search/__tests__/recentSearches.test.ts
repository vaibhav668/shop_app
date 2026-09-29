import {
  loadRecentSearches,
  MAX_RECENT,
  saveRecentSearches,
  withRecent,
} from '@/features/search/recentSearches';

describe('withRecent', () => {
  it('puts the newest first and tidies spacing', () => {
    expect(withRecent(['atta'], '  toned   milk ')).toEqual(['toned milk', 'atta']);
  });

  it('de-duplicates case-insensitively, keeping the newest spelling', () => {
    expect(withRecent(['Milk', 'atta'], 'milk')).toEqual(['milk', 'atta']);
  });

  it(`keeps at most ${MAX_RECENT}`, () => {
    const many = Array.from({ length: MAX_RECENT }, (_, i) => `item ${i}`);
    const next = withRecent(many, 'new');
    expect(next).toHaveLength(MAX_RECENT);
    expect(next[0]).toBe('new');
    expect(next).not.toContain(`item ${MAX_RECENT - 1}`);
  });

  it('ignores blank searches', () => {
    expect(withRecent(['atta'], '   ')).toEqual(['atta']);
  });
});

describe('storage', () => {
  it('round-trips through device storage', async () => {
    await saveRecentSearches(['dal', 'chai']);
    await expect(loadRecentSearches()).resolves.toEqual(['dal', 'chai']);
  });
});
