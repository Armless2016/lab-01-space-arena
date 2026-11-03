import { describe, expect, it } from 'vitest';
import { getErrorMessage, getProtocolCloseCode, parseClientMessage, ProtocolError } from '../src/protocol.ts';

describe('server WebSocket protocol boundary', () => {
  it('accepts valid JSON join message', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'join', roomId: 'rookie-orbit', playerName: 'Pilot' }), 1024).type).toBe('join');
  });
  it('rejects malformed JSON with ProtocolError', () => {
    expect(() => parseClientMessage('{broken', 1024)).toThrow(ProtocolError);
  });
  it('rejects invalid shape with ProtocolError', () => {
    expect(() => parseClientMessage(JSON.stringify({ type: 'teleport', x: 5 }), 1024)).toThrow(ProtocolError);
  });
  it('rejects a message larger than the maximum frame size', () => {
    expect(() => parseClientMessage(JSON.stringify({ type: 'chat', message: 'x'.repeat(100) }), 20)).toThrow(/too large/);
  });
  it('rejects binary payloads on the JSON parser', () => {
    expect(() => parseClientMessage(new Uint8Array([1, 2]), 1024)).toThrow(/text JSON/);
  });
  it('maps malformed protocol errors to close code 1008', () => {
    expect(getProtocolCloseCode(new ProtocolError('bad'))).toBe(1008);
  });
  it('preserves explicit close code 1009', () => {
    expect(getProtocolCloseCode(new ProtocolError('too large', 1009))).toBe(1009);
  });
  it('formats unknown errors safely', () => {
    expect(getErrorMessage({ secret: true })).toBe('invalid message');
  });
  it('formats Error messages', () => expect(getErrorMessage(new Error('failure'))).toBe('failure'));
});
