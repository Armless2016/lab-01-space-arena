import type { VectorLike } from './types.ts';
/** Immutable vector value: every operation returns a new Vector2. */
export declare class Vector2 implements VectorLike {
    readonly x: number;
    readonly y: number;
    constructor(x: number, y: number);
    add(other: VectorLike): Vector2;
    subtract(other: VectorLike): Vector2;
    scale(factor: number): Vector2;
    get length(): number;
    normalized(): Vector2;
    static fromAngle(angle: number, magnitude?: number): Vector2;
}
