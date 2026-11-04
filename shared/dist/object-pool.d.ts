/** Small bounded object pool for short-lived simulation/render objects. */
export declare class ObjectPool<T> {
    #private;
    private readonly factory;
    private readonly maxSize;
    constructor(factory: () => T, maxSize?: number);
    acquire(): T;
    release(item: T): void;
    releaseMany(items: Iterable<T>): void;
    get available(): number;
}
