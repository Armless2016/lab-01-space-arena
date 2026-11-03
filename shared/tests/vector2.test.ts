import { describe, expect, it } from 'vitest';
import { Vector2 } from '../vector2.ts';

const addCases: Array<[number, number, number, number, number, number]> = [
  [1, 2, 3, 4, 4, 6], [0, 0, 0, 0, 0, 0], [-2, 5, 7, -3, 5, 2],
  [8, -1, -3, 9, 5, 8], [10, 10, 0, -10, 10, 0],
];
const subtractCases: Array<[number, number, number, number, number, number]> = [
  [5, 7, 2, 3, 3, 4], [0, 0, 0, 0, 0, 0], [-4, 9, 2, 3, -6, 6],
  [10, -5, -5, 5, 15, -10], [100, 50, 25, 10, 75, 40],
];
const scaleCases: Array<[number, number, number, number, number]> = [
  [2, 3, 2, 4, 6], [-2, 5, -3, 6, -15], [0, 1, 9, 0, 9], [4, -2, 0.5, 2, -1],
];

describe('Vector2', () => {
  it.each(addCases)('adds (%s,%s) and (%s,%s)', (ax, ay, bx, by, x, y) => {
    expect(new Vector2(ax, ay).add(new Vector2(bx, by))).toEqual(new Vector2(x, y));
  });
  it.each(subtractCases)('subtracts (%s,%s) and (%s,%s) without mutating source', (ax, ay, bx, by, x, y) => {
    const first = new Vector2(ax, ay);
    expect(first.subtract(new Vector2(bx, by))).toEqual(new Vector2(x, y));
    expect(first).toEqual(new Vector2(ax, ay));
  });
  it.each(scaleCases)('scales (%s,%s) by %s', (x, y, factor, expectedX, expectedY) => {
    expect(new Vector2(x, y).scale(factor)).toEqual(new Vector2(expectedX, expectedY));
  });
  it('computes Euclidean length', () => expect(new Vector2(3, 4).length).toBe(5));
  it('normalizes to unit length', () => expect(new Vector2(3, 4).normalized().length).toBeCloseTo(1));
  it('normalizes the zero vector safely', () => expect(new Vector2(0, 0).normalized()).toEqual(new Vector2(0, 0)));
  it('creates vectors from angle', () => expect(Vector2.fromAngle(Math.PI / 2, 4).y).toBeCloseTo(4));
});
