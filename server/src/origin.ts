import type { IncomingMessage } from 'node:http';

export interface OriginPolicy {
  readonly allowedOrigins: readonly string[];
  readonly allowMissingOrigin: boolean;
  readonly trustProxy: boolean;
  readonly maxConnectionsPerIp: number;
}

export function isAllowedOrigin(origin: string | undefined, policy: Pick<OriginPolicy, 'allowedOrigins' | 'allowMissingOrigin'>): boolean {
  if (!origin) return policy.allowMissingOrigin;
  try {
    const parsed = new URL(origin);
    return parsed.origin === origin && policy.allowedOrigins.includes(origin);
  } catch {
    return false;
  }
}

export function getClientIp(request: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = request.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return request.socket.remoteAddress ?? 'unknown';
}

/** Connection accounting is isolated so proxy/IP limits can be tested without a live socket. */
export class IpConnectionLimiter {
  readonly #active = new Map<string, number>();
  readonly #limit: number;

  public constructor(limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('IP connection limit must be positive');
    this.#limit = limit;
  }

  public acquire(ip: string): boolean {
    const count = this.#active.get(ip) ?? 0;
    if (count >= this.#limit) return false;
    this.#active.set(ip, count + 1);
    return true;
  }

  public release(ip: string): void {
    const count = this.#active.get(ip) ?? 0;
    if (count <= 1) this.#active.delete(ip);
    else this.#active.set(ip, count - 1);
  }

  public count(ip: string): number { return this.#active.get(ip) ?? 0; }
  public get total(): number { return [...this.#active.values()].reduce((sum, count) => sum + count, 0); }
}
