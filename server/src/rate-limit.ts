/** Fixed-window message limiter using a monotonic clock (injectable in tests). */
export function createMessageRateLimiter(
  limit: number,
  windowMs = 1000,
  now: () => number = () => performance.now(),
): () => boolean {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be a positive integer');
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new RangeError('windowMs must be positive');
  let windowStart = now();
  let count = 0;
  return (): boolean => {
    const current = now();
    if (current - windowStart >= windowMs) {
      windowStart = current;
      count = 0;
    }
    count += 1;
    return count <= limit;
  };
}
