/** Small bounded object pool for short-lived simulation/render objects. */
export class ObjectPool<T> {
  readonly #items: T[] = [];

  public constructor(
    private readonly factory: () => T,
    private readonly maxSize = 512,
  ) {
    if (!Number.isInteger(maxSize) || maxSize < 0) throw new RangeError('maxSize must be a non-negative integer');
  }

  public acquire(): T {
    return this.#items.pop() ?? this.factory();
  }

  public release(item: T): void {
    if (this.#items.length < this.maxSize) this.#items.push(item);
  }

  public releaseMany(items: Iterable<T>): void {
    for (const item of items) this.release(item);
  }

  public get available(): number {
    return this.#items.length;
  }
}
