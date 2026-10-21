import { mkdir } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { Readable, Transform, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

export type MatchLogEvent = Readonly<Record<string, unknown>>;

class EventReadable extends Readable {
  #queue: MatchLogEvent[] = [];
  #ended = false;

  public constructor() { super({ objectMode: true }); }

  public override _read(): void {
    while (this.#queue.length > 0) {
      const next = this.#queue.shift();
      if (next === undefined) break;
      if (!this.push(next)) return;
    }
    if (this.#ended) this.push(null);
  }

  public enqueue(event: MatchLogEvent): boolean {
    if (this.#ended) return false;
    this.#queue.push(event);
    this._read();
    return this.#queue.length < 128;
  }

  public endSource(): void { this.#ended = true; this._read(); }
}

export class MatchLogger {
  public readonly filePath: string;
  readonly #source = new EventReadable();
  readonly #transform = new Transform({
    writableObjectMode: true,
    transform(event: MatchLogEvent, _encoding: BufferEncoding, callback: TransformCallback): void {
      callback(null, `${JSON.stringify(event)}\n`);
    },
  });
  #destination: ReturnType<typeof createWriteStream> | null = null;
  #pipelinePromise: Promise<void> | null = null;

  public constructor(logDir: string, roomId: string) {
    this.filePath = path.join(logDir, `${roomId}.ndjson`);
  }

  public async start(): Promise<this> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    this.#destination = createWriteStream(this.filePath, { flags: 'a' });
    this.#pipelinePromise = pipeline(this.#source, this.#transform, this.#destination).catch((error: unknown) => {
      this.#source.destroy(error instanceof Error ? error : new Error('match log stream failed'));
      throw error;
    });
    return this;
  }

  public append(event: MatchLogEvent): boolean { return this.#source.enqueue(event); }

  public async close(): Promise<void> {
    if (!this.#pipelinePromise) return;
    this.#source.endSource();
    await this.#pipelinePromise;
  }

  public replayStream(): ReturnType<typeof createReadStream> { return createReadStream(this.filePath); }
}

export async function createMatchLogger(logDir: string, roomId: string): Promise<MatchLogger> {
  return new MatchLogger(logDir, roomId).start();
}
