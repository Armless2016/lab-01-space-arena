import type { IncomingMessage } from 'node:http';
import { Buffer } from 'node:buffer';

export class RequestBodyError extends Error {
  public constructor(message: string, public readonly code: 'BODY_TOO_LARGE' | 'BAD_JSON') {
    super(message);
    this.name = 'RequestBodyError';
  }
}

export async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) throw new RequestBodyError(`request body exceeds ${maxBytes} bytes`, 'BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  if (!body) return {};
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'invalid JSON body';
    throw new RequestBodyError(detail, 'BAD_JSON');
  }
}
