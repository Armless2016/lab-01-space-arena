import { decodeSnapshotBinary, encodeInputBinary } from '@space-arena/shared/protocol';
import { ClientMessageSchema, ServerMessageSchema, type ParsedClientMessage, type ParsedServerMessage } from '@space-arena/shared/schemas';

function viewToArrayBuffer(view: ArrayBufferView): ArrayBuffer {
  const copy = new Uint8Array(view.byteLength);
  copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return copy.buffer;
}

export type SocketProtocol = 'json' | 'binary';
export type IncomingMessage = ParsedServerMessage & { readonly __transportBytes?: number };
export interface SocketStateDetail {
  readonly state: 'connecting' | 'open' | 'error' | 'closed' | 'reconnecting';
  readonly delay?: number;
  readonly code?: number;
  readonly reason?: string;
}
export interface SocketMessageDetail { readonly message: IncomingMessage }
export interface SocketErrorDetail { readonly error: unknown }
interface JoinedRoom { readonly roomId: string; readonly playerName: string; readonly protocol: SocketProtocol }
type WireFrame = string | ArrayBuffer;
type OutgoingMessage = ParsedClientMessage;

function frameSize(frame: WireFrame): number {
  return typeof frame === 'string' ? new TextEncoder().encode(frame).byteLength : frame.byteLength;
}
function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }

export class ReconnectingSocket extends EventTarget {
  #url: string;
  #socket: WebSocket | null = null;
  #queue: WireFrame[] = [];
  #attempt = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #stopped = false;
  #joined: JoinedRoom | null = null;
  #protocol: SocketProtocol = 'binary';
  readonly maxQueue: number;
  readonly maxDelay: number;

  constructor(url = '/ws', { maxQueue = 100, maxDelay = 8000 }: { readonly maxQueue?: number; readonly maxDelay?: number } = {}) {
    super();
    this.#url = url;
    this.maxQueue = maxQueue;
    this.maxDelay = maxDelay;
  }

  connect(): void { this.#stopped = false; this.#open(); }

  join(roomId: string, playerName: string, protocol: string = 'binary'): void {
    this.#protocol = protocol === 'json' ? 'json' : 'binary';
    this.#joined = { roomId, playerName, protocol: this.#protocol };
    if (this.#socket?.readyState === WebSocket.OPEN) this.send({ type: 'join', ...this.#joined });
  }

  send(payload: OutgoingMessage): number {
    let frame: WireFrame;
    try {
      const parsed = ClientMessageSchema.parse(payload);
      frame = parsed.type === 'input' && this.#protocol === 'binary'
        ? encodeInputBinary(parsed)
        : JSON.stringify(parsed);
    } catch (error: unknown) {
      this.dispatchEvent(new CustomEvent<SocketErrorDetail>('error', { detail: { error } }));
      return 0;
    }
    const bytes = frameSize(frame);
    const socket = this.#socket;
    if (socket?.readyState === WebSocket.OPEN) {
      if (socket.bufferedAmount > 64 * 1024 && payload.type === 'input') return 0;
      socket.send(frame);
      return bytes;
    }
    if (payload.type === 'input') return 0;
    if (this.#queue.length >= this.maxQueue) this.#queue.shift();
    this.#queue.push(frame);
    return bytes;
  }

  close(): void {
    this.#stopped = true;
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    this.#joined = null;
    this.#queue = [];
    this.#socket?.close(1000, 'client closed');
    this.#socket = null;
  }

  get bufferedAmount(): number { return this.#socket?.bufferedAmount ?? 0; }
  get protocol(): SocketProtocol { return this.#protocol; }

  #state(detail: SocketStateDetail): void {
    this.dispatchEvent(new CustomEvent<SocketStateDetail>('state', { detail }));
  }

  #open(): void {
    if (this.#stopped || this.#socket) return;
    this.#state({ state: 'connecting' });
    const socket = new WebSocket(this.#url);
    socket.binaryType = 'arraybuffer';
    this.#socket = socket;
    socket.addEventListener('open', () => {
      this.#attempt = 0;
      this.#state({ state: 'open' });
      if (this.#joined) this.send({ type: 'join', ...this.#joined });
      this.#flush();
    });
    socket.addEventListener('message', (event: MessageEvent<unknown>) => {
      try {
        const data: unknown = event.data;
        let bytes: number;
        let message: ParsedServerMessage;
        if (data instanceof ArrayBuffer) {
          bytes = frameSize(data);
          message = decodeSnapshotBinary(data);
        } else if (ArrayBuffer.isView(data)) {
          // Copy the view into a fresh ArrayBuffer so SharedArrayBuffer-backed views are safe too.
          const buffer = viewToArrayBuffer(data);
          bytes = frameSize(buffer);
          message = decodeSnapshotBinary(buffer);
        } else {
          const text = String(data);
          bytes = frameSize(text);
          const raw: unknown = JSON.parse(text);
          message = ServerMessageSchema.parse(raw);
        }
        const detail: IncomingMessage = { ...message, __transportBytes: bytes };
        this.dispatchEvent(new CustomEvent<IncomingMessage>('message', { detail }));
      } catch (error: unknown) {
        this.dispatchEvent(new CustomEvent<SocketErrorDetail>('error', { detail: { error: new Error(`Invalid server frame: ${errorText(error)}`) } }));
      }
    });
    socket.addEventListener('error', () => this.#state({ state: 'error' }));
    socket.addEventListener('close', (event: CloseEvent) => {
      if (this.#socket === socket) this.#socket = null;
      this.#state({ state: 'closed', code: event.code, reason: event.reason });
      if (!this.#stopped && event.code !== 1008 && event.code !== 1009) this.#scheduleReconnect();
    });
  }

  #flush(): void {
    const socket = this.#socket;
    while (this.#queue.length > 0 && socket?.readyState === WebSocket.OPEN) {
      const frame = this.#queue.shift();
      if (frame !== undefined) socket.send(frame);
    }
  }

  #scheduleReconnect(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    const base = Math.min(this.maxDelay, 250 * 2 ** this.#attempt);
    const delay = base + Math.random() * 180;
    this.#attempt += 1;
    this.#timer = setTimeout(() => { this.#timer = null; this.#open(); }, delay);
    this.#state({ state: 'reconnecting', delay });
  }
}
