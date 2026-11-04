import type { InputMessage, ShipState } from './types.ts';
export interface ReconcileResult {
    readonly state: ShipState;
    readonly pending: readonly InputMessage[];
}
/** Rebuild a predicted ship from an authoritative state and unacknowledged inputs. */
export declare function reconcileShip(authoritative: ShipState, history: readonly InputMessage[], ackSeq: number, dt: number, bounds: {
    readonly width: number;
    readonly height: number;
}): ReconcileResult;
