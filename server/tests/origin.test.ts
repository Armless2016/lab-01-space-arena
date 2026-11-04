import { describe, expect, it } from 'vitest';
import { IpConnectionLimiter, isAllowedOrigin } from '../src/origin.ts';

describe('production websocket origin and IP policy', () => {
  const policy = { allowedOrigins: ['https://arena.example.com', 'https://www.arena.example.com'], allowMissingOrigin: false };

  it('accepts only an exact configured Origin', () => {
    expect(isAllowedOrigin('https://arena.example.com', policy)).toBe(true);
    expect(isAllowedOrigin('https://evil.example.com', policy)).toBe(false);
    expect(isAllowedOrigin('https://arena.example.com/path', policy)).toBe(false);
  });

  it('rejects a missing Origin in production but can allow non-browser development clients', () => {
    expect(isAllowedOrigin(undefined, policy)).toBe(false);
    expect(isAllowedOrigin(undefined, { ...policy, allowMissingOrigin: true })).toBe(true);
  });

  it('rejects malformed Origin values', () => {
    expect(isAllowedOrigin('not a URL', policy)).toBe(false);
  });

  it('caps simultaneous sockets from one IP and releases them on close', () => {
    const limiter = new IpConnectionLimiter(2);
    expect(limiter.acquire('203.0.113.10')).toBe(true);
    expect(limiter.acquire('203.0.113.10')).toBe(true);
    expect(limiter.acquire('203.0.113.10')).toBe(false);
    expect(limiter.acquire('203.0.113.11')).toBe(true);
    limiter.release('203.0.113.10');
    expect(limiter.acquire('203.0.113.10')).toBe(true);
    expect(limiter.total).toBe(3);
  });
});
