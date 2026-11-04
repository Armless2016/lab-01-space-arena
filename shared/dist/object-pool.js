/** Small bounded object pool for short-lived simulation/render objects. */
export class ObjectPool {
    factory;
    maxSize;
    #items = [];
    constructor(factory, maxSize = 512) {
        this.factory = factory;
        this.maxSize = maxSize;
        if (!Number.isInteger(maxSize) || maxSize < 0)
            throw new RangeError('maxSize must be a non-negative integer');
    }
    acquire() {
        return this.#items.pop() ?? this.factory();
    }
    release(item) {
        if (this.#items.length < this.maxSize)
            this.#items.push(item);
    }
    releaseMany(items) {
        for (const item of items)
            this.release(item);
    }
    get available() {
        return this.#items.length;
    }
}
