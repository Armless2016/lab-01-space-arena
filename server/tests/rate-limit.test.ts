import { describe, expect, it } from 'vitest';
import { createMessageRateLimiter } from '../src/rate-limit.ts';

describe('WebSocket message rate limiter', () => {
  it('allows messages up to the configured limit', () => {
    const now = 0; const limit = createMessageRateLimiter(3, 1000, () => now);
    expect(limit()).toBe(true); expect(limit()).toBe(true); expect(limit()).toBe(true);
  });
  it('rejects messages above the configured limit', () => {
    const limit = createMessageRateLimiter(2, 1000, () => 10);
    limit(); limit(); expect(limit()).toBe(false);
  });
  it('resets at the next fixed window', () => {
    let now = 0; const limit = createMessageRateLimiter(1, 1000, () => now);
    expect(limit()).toBe(true); expect(limit()).toBe(false); now = 1000; expect(limit()).toBe(true);
  });
  it('does not reset before the window duration', () => {
    let now = 0; const limit = createMessageRateLimiter(1, 1000, () => now);
    limit(); now = 999; expect(limit()).toBe(false);
  });
  it('supports an injected monotonic clock', () => {
    let now = 50; const limit = createMessageRateLimiter(2, 50, () => now);
    expect(limit()).toBe(true); now = 100; expect(limit()).toBe(true);
  });
  it('rejects invalid message limits', () => expect(() => createMessageRateLimiter(0)).toThrow(RangeError));
  it('rejects invalid window durations', () => expect(() => createMessageRateLimiter(2, 0)).toThrow(RangeError));
  it('uses performance.now by default', () => expect(createMessageRateLimiter(1)()).toBe(true));
});
