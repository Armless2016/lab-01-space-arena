export interface CircleLike {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
}
/** Circle-circle collision in a toroidal arena (ships can wrap at the edges). */
export declare function circlesOverlap(a: CircleLike, b: CircleLike, width: number, height: number): boolean;
export declare function squaredToroidalDistance(a: Pick<CircleLike, 'x' | 'y'>, b: Pick<CircleLike, 'x' | 'y'>, width: number, height: number): number;
