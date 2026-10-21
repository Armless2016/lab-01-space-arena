import { Buffer } from 'node:buffer';
import type { WebSocket } from 'ws';
import { ClientMessageSchema, type ParsedClientMessage } from '@space-arena/shared/schemas';
import { decodeInputBinary } from '@space-arena/shared/protocol';

export class ProtocolError extends Error {
  public constructor(message: string, public readonly closeCode: number = 1008) {
    super(message);
    this.name = 'ProtocolError';
  }
}

/** Decode untrusted network data. Zod is the single runtime validator for JSON input. */
export function parseClientMessage(raw: unknown, maxBytes: number): ParsedClientMessage {
  if (typeof raw !== 'string') throw new ProtocolError('expected a text JSON frame');
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) throw new ProtocolError('message too large', 1009);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'invalid JSON';
    throw new ProtocolError(`invalid JSON: ${detail}`);
  }

  const result = ClientMessageSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ProtocolError(issue?.message ?? 'invalid client message');
  }
  return result.data;
}

export { decodeInputBinary };

export function getProtocolCloseCode(error: unknown): number {
  return error instanceof ProtocolError ? error.closeCode : 1008;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'invalid message';
}

export function sendJson(ws: WebSocket, payload: unknown): boolean {
  if (ws.readyState !== 1) return false;
  ws.send(JSON.stringify(payload));
  return true;
}
