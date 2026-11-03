import { integrateShip, cloneShip } from './simulation.ts';
import type { ControlInput, InputMessage, ShipState } from './types.ts';

export interface ReconcileResult {
  readonly state: ShipState;
  readonly pending: readonly InputMessage[];
}

/** Rebuild a predicted ship from an authoritative state and unacknowledged inputs. */
export function reconcileShip(
  authoritative: ShipState,
  history: readonly InputMessage[],
  ackSeq: number,
  dt: number,
  bounds: { readonly width: number; readonly height: number },
): ReconcileResult {
  const pending = history.filter((input) => Number(input.seq) > ackSeq);
  let state = cloneShip(authoritative);
  for (const input of pending) {
    const result = integrateShip(state, input satisfies ControlInput, dt, bounds);
    state = result.state;
  }
  return { state, pending };
}
