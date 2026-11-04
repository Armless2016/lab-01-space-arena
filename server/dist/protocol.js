import { Buffer } from 'node:buffer';
import { ClientMessageSchema } from '@space-arena/shared/schemas';
import { decodeInputBinary } from '@space-arena/shared/protocol';
export class ProtocolError extends Error {
    closeCode;
    constructor(message, closeCode = 1008) {
        super(message);
        this.closeCode = closeCode;
        this.name = 'ProtocolError';
    }
}
/** Decode untrusted network data. Zod is the single runtime validator for JSON input. */
export function parseClientMessage(raw, maxBytes) {
    if (typeof raw !== 'string')
        throw new ProtocolError('expected a text JSON frame');
    if (Buffer.byteLength(raw, 'utf8') > maxBytes)
        throw new ProtocolError('message too large', 1009);
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (error) {
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
export function getProtocolCloseCode(error) {
    return error instanceof ProtocolError ? error.closeCode : 1008;
}
export function getErrorMessage(error) {
    return error instanceof Error ? error.message : 'invalid message';
}
export function sendJson(ws, payload) {
    if (ws.readyState !== 1)
        return false;
    ws.send(JSON.stringify(payload));
    return true;
}
