import { describe, expect, it } from 'vitest';

import { sortExperience } from './sort-experience';

describe('sortExperience', () => {
  it('places current roles (end: null) before past roles', () => {
    const past = { id: 'past', start: '2019-01', end: '2020-01' };
    const current = { id: 'current', start: '2021-01', end: null };

    const result = sortExperience([past, current]);

    expect(result.map((entry) => entry.id)).toEqual(['current', 'past']);
  });

  it('orders past roles by end date, most recent first', () => {
    const older = { id: 'older', start: '2018-01', end: '2019-01' };
    const newer = { id: 'newer', start: '2020-01', end: '2021-01' };

    const result = sortExperience([older, newer]);

    expect(result.map((entry) => entry.id)).toEqual(['newer', 'older']);
  });

  it('breaks ties on the same end date by start date, most recent first', () => {
    const shorter = { id: 'shorter', start: '2020-06', end: '2021-01' };
    const longer = { id: 'longer', start: '2019-01', end: '2021-01' };

    const result = sortExperience([longer, shorter]);

    expect(result.map((entry) => entry.id)).toEqual(['shorter', 'longer']);
  });

  it('orders multiple current roles by start date, most recent first', () => {
    const olderStart = { id: 'olderStart', start: '2020-01', end: null };
    const newerStart = { id: 'newerStart', start: '2022-01', end: null };

    const result = sortExperience([olderStart, newerStart]);

    expect(result.map((entry) => entry.id)).toEqual([
      'newerStart',
      'olderStart',
    ]);
  });

  it('does not mutate the input array', () => {
    const entries = [
      { id: 'a', start: '2019-01', end: '2020-01' },
      { id: 'b', start: '2021-01', end: null },
    ];
    const copy = [...entries];

    sortExperience(entries);

    expect(entries).toEqual(copy);
  });
});
