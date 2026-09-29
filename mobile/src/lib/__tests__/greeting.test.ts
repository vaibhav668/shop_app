import { greetingFor } from '@/lib/greeting';

const at = (hour: number) => new Date(2026, 0, 1, hour, 0, 0);

describe('greetingFor', () => {
  it.each([
    [6, 'Good morning'],
    [11, 'Good morning'],
    [12, 'Good afternoon'],
    [16, 'Good afternoon'],
    [17, 'Good evening'],
    [23, 'Good evening'],
  ])('at %i:00 says %s', (hour, expected) => {
    expect(greetingFor(at(hour))).toBe(expected);
  });
});
