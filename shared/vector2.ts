import type { VectorLike } from './types.ts';

/** Immutable vector value: every operation returns a new Vector2. */
export class Vector2 implements VectorLike {
  public constructor(public readonly x: number, public readonly y: number) {}

  public add(other: VectorLike): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  public subtract(other: VectorLike): Vector2 {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  public scale(factor: number): Vector2 {
    return new Vector2(this.x * factor, this.y * factor);
  }

  public get length(): number {
    return Math.hypot(this.x, this.y);
  }

  public normalized(): Vector2 {
    const magnitude = this.length;
    return magnitude === 0 ? new Vector2(0, 0) : this.scale(1 / magnitude);
  }

  public static fromAngle(angle: number, magnitude = 1): Vector2 {
    return new Vector2(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);
  }
}
