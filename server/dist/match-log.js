import { mkdir } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
class EventReadable extends Readable {
    #queue = [];
    #ended = false;
    constructor() { super({ objectMode: true }); }
    _read() {
        while (this.#queue.length > 0) {
            const next = this.#queue.shift();
            if (next === undefined)
                break;
            if (!this.push(next))
                return;
        }
        if (this.#ended)
            this.push(null);
    }
    enqueue(event) {
        if (this.#ended)
            return false;
        this.#queue.push(event);
        this._read();
        return this.#queue.length < 128;
    }
    endSource() { this.#ended = true; this._read(); }
}
export class MatchLogger {
    filePath;
    #source = new EventReadable();
    #transform = new Transform({
        writableObjectMode: true,
        transform(event, _encoding, callback) {
            callback(null, `${JSON.stringify(event)}\n`);
        },
    });
    #destination = null;
    #pipelinePromise = null;
    constructor(logDir, roomId) {
        this.filePath = path.join(logDir, `${roomId}.ndjson`);
    }
    async start() {
        await mkdir(path.dirname(this.filePath), { recursive: true });
        this.#destination = createWriteStream(this.filePath, { flags: 'a' });
        this.#pipelinePromise = pipeline(this.#source, this.#transform, this.#destination).catch((error) => {
            this.#source.destroy(error instanceof Error ? error : new Error('match log stream failed'));
            throw error;
        });
        return this;
    }
    append(event) { return this.#source.enqueue(event); }
    async close() {
        if (!this.#pipelinePromise)
            return;
        this.#source.endSource();
        await this.#pipelinePromise;
    }
    replayStream() { return createReadStream(this.filePath); }
}
export async function createMatchLogger(logDir, roomId) {
    return new MatchLogger(logDir, roomId).start();
}
