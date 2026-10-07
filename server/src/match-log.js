import { mkdir } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

class EventReadable extends Readable {
  constructor() {
    super({ objectMode: true });
    this.queue = [];
    this.ended = false;
  }

  _read() {
    while (this.queue.length > 0) {
      if (!this.push(this.queue.shift())) return;
    }
    if (this.ended) this.push(null);
  }

  enqueue(event) {
    if (this.ended) return false;
    this.queue.push(event);
    this._read();
    return this.queue.length < 128;
  }

  endSource() {
    this.ended = true;
    this._read();
  }
}

export class MatchLogger {
  constructor(logDir, roomId) {
    this.filePath = path.join(logDir, `${roomId}.ndjson`);
    this.source = new EventReadable();
    this.transform = new Transform({
      writableObjectMode: true,
      transform(event, _encoding, callback) {
        callback(null, `${JSON.stringify(event)}\n`);
      },
    });
    this.destination = null;
    this.pipelinePromise = null;
  }

  async start() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    this.destination = createWriteStream(this.filePath, { flags: 'a' });
    this.pipelinePromise = pipeline(this.source, this.transform, this.destination).catch((error) => {
      this.source.destroy(error);
      throw error;
    });
    return this;
  }

  append(event) {
    return this.source.enqueue(event);
  }

  async close() {
    if (!this.pipelinePromise) return;
    this.source.endSource();
    await this.pipelinePromise;
  }

  replayStream() {
    return createReadStream(this.filePath);
  }
}

export async function createMatchLogger(logDir, roomId) {
  return new MatchLogger(logDir, roomId).start();
}
