import { resolveApiUrl } from '@/lib/config';

const LOCAL = 'http://localhost:8000/api/v1';

describe('resolveApiUrl', () => {
  it('points a phone at the PC the dev server runs on', () => {
    expect(resolveApiUrl(LOCAL, '172.28.66.14:8081')).toBe('http://172.28.66.14:8000/api/v1');
    expect(resolveApiUrl('http://127.0.0.1:8000/api/v1', '192.168.1.20:8081')).toBe(
      'http://192.168.1.20:8000/api/v1',
    );
  });

  it('leaves a real address alone', () => {
    const deployed = 'https://api.badabazar.in/api/v1';
    expect(resolveApiUrl(deployed, '172.28.66.14:8081')).toBe(deployed);
  });

  it('keeps localhost when there is no better address', () => {
    expect(resolveApiUrl(LOCAL, undefined)).toBe(LOCAL);
    expect(resolveApiUrl(LOCAL, 'localhost:8081')).toBe(LOCAL);
  });
});
