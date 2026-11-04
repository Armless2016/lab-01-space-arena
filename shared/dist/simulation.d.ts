import { type BulletState, type ControlInput, type EntityId, type ShipState, type SimulationState } from './types.ts';
/**
 * Deterministic simulation shared by browser and Node.js.
 * No DOM, Node imports, Date.now(), or Math.random() in this module.
 */
export declare const SIM_HZ = 30;
export declare const SIM_DT: number;
export declare const PROTOCOL_VERSION = 3;
export declare function hashSeed(value: string | number): number;
export declare function wrap(value: number, size: number): number;
export interface SimulationOptions {
    width?: number;
    height?: number;
    seed?: number;
    asteroidCount?: number;
    pickupCount?: number;
    enemyCount?: number;
    enemyHp?: number;
}
export declare function createSimulation({ width, height, seed, asteroidCount, pickupCount, enemyCount, enemyHp, }?: SimulationOptions): SimulationState;
export declare function createPlayerShip(id: number | EntityId, width: number, height: number, slot?: number): ShipState;
export declare function addPlayer(simulation: SimulationState, id: number | EntityId): ShipState;
export declare function removePlayer(simulation: SimulationState, id: number | EntityId): void;
/** Pure fixed-step integration: returns a new state and whether this step fired. */
export declare function integrateShip(ship: ShipState, input?: ControlInput, dt?: number, bounds?: {
    width?: number;
    height?: number;
}): {
    state: ShipState;
    fired: boolean;
};
export declare function createBulletFromShip(ship: ShipState, id: number | EntityId, ownerId?: number | EntityId, homing?: boolean, reuse?: BulletState): BulletState;
export declare function stepSimulation(simulation: SimulationState, inputsByPlayerId?: ReadonlyMap<EntityId, ControlInput>, dt?: number): SimulationState;
export declare function cloneShip(ship: ShipState): ShipState;
