export function isAllowedOrigin(origin, policy) {
    if (!origin)
        return policy.allowMissingOrigin;
    try {
        const parsed = new URL(origin);
        return parsed.origin === origin && policy.allowedOrigins.includes(origin);
    }
    catch {
        return false;
    }
}
export function getClientIp(request, trustProxy) {
    if (trustProxy) {
        const forwarded = request.headers['x-forwarded-for'];
        const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
        if (first)
            return first.slice(0, 64);
    }
    return request.socket.remoteAddress ?? 'unknown';
}
/** Connection accounting is isolated so proxy/IP limits can be tested without a live socket. */
export class IpConnectionLimiter {
    #active = new Map();
    #limit;
    constructor(limit) {
        if (!Number.isInteger(limit) || limit < 1)
            throw new RangeError('IP connection limit must be positive');
        this.#limit = limit;
    }
    acquire(ip) {
        const count = this.#active.get(ip) ?? 0;
        if (count >= this.#limit)
            return false;
        this.#active.set(ip, count + 1);
        return true;
    }
    release(ip) {
        const count = this.#active.get(ip) ?? 0;
        if (count <= 1)
            this.#active.delete(ip);
        else
            this.#active.set(ip, count - 1);
    }
    count(ip) { return this.#active.get(ip) ?? 0; }
    get total() { return [...this.#active.values()].reduce((sum, count) => sum + count, 0); }
}
