import { Buffer } from 'node:buffer';
export class RequestBodyError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'RequestBodyError';
    }
}
export async function readJsonBody(req, maxBytes) {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > maxBytes)
            throw new RequestBodyError(`request body exceeds ${maxBytes} bytes`, 'BODY_TOO_LARGE');
        chunks.push(buffer);
    }
    const body = Buffer.concat(chunks).toString('utf8');
    if (!body)
        return {};
    try {
        const parsed = JSON.parse(body);
        return parsed;
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : 'invalid JSON body';
        throw new RequestBodyError(detail, 'BAD_JSON');
    }
}
