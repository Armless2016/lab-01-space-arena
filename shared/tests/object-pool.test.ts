import { describe, expect, it } from 'vitest';
import { ObjectPool } from '../object-pool.ts';

describe('ObjectPool', () => {
  it('creates an object when empty', () => {
    let created = 0;
    const pool = new ObjectPool(() => ({ id: ++created }));
    expect(pool.acquire()).toEqual({ id: 1 });
    expect(created).toBe(1);
  });
  it('reuses a released object', () => {
    const pool = new ObjectPool(() => ({ value: 0 }));
    const item = pool.acquire();
    item.value = 42;
    pool.release(item);
    expect(pool.acquire()).toBe(item);
  });
  it('does not exceed the configured capacity', () => {
    const pool = new ObjectPool(() => ({}), 2);
    pool.release({ id: 1 });
    pool.release({ id: 2 });
    pool.release({ id: 3 });
    expect(pool.available).toBe(2);
  });
  it('releases iterables', () => {
    const pool = new ObjectPool(() => ({}));
    pool.releaseMany([{ a: 1 }, { a: 2 }, { a: 3 }]);
    expect(pool.available).toBe(3);
  });
  it('rejects invalid capacity', () => expect(() => new ObjectPool(() => ({}), -1)).toThrow(RangeError));
  it('returns distinct items when the pool is empty', () => {
    const pool = new ObjectPool(() => ({}));
    expect(pool.acquire()).not.toBe(pool.acquire());
  });
});
