import { describe, expect, it } from 'vitest';
import { circlesOverlap, squaredToroidalDistance } from '../collision.ts';

const circleCases: Array<[number, number, number, number, number, number, boolean]> = [
  [0, 0, 5, 5, 2, 2, true],
  // Centers are 4 units apart; radii sum to 5, so these circles overlap.
  [0, 0, 2, 4, 0, 3, true],
  [0, 0, 2, 20, 0, 3, false],
  [99, 50, 3, 2, 50, 3, true],
  [10, 10, 4, 18, 10, 4, true],
  [10, 10, 4, 19, 10, 4, false],
  [50, 50, 0, 50, 50, 0, true],
  [0, 0, 1, 98, 0, 1, true],
];

describe('toroidal circle collisions', () => {
  it.each(circleCases)('checks circles at (%s,%s) and (%s,%s)', (ax, ay, ar, bx, by, br, expected) => {
    expect(circlesOverlap({ x: ax, y: ay, radius: ar }, { x: bx, y: by, radius: br }, 100, 100)).toBe(expected);
  });
  it('returns squared toroidal distance across a horizontal boundary', () => {
    expect(squaredToroidalDistance({ x: 2, y: 10 }, { x: 98, y: 10 }, 100, 100)).toBe(16);
  });
  it('returns squared toroidal distance across a vertical boundary', () => {
    expect(squaredToroidalDistance({ x: 10, y: 3 }, { x: 10, y: 97 }, 100, 100)).toBe(36);
  });
  it('is symmetric', () => {
    const a = { x: 3, y: 8, radius: 5 };
    const b = { x: 98, y: 8, radius: 4 };
    expect(circlesOverlap(a, b, 100, 100)).toBe(circlesOverlap(b, a, 100, 100));
  });
});
