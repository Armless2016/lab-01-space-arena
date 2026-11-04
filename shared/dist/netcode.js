import { integrateShip, cloneShip } from "./simulation.js";
/** Rebuild a predicted ship from an authoritative state and unacknowledged inputs. */
export function reconcileShip(authoritative, history, ackSeq, dt, bounds) {
    const pending = history.filter((input) => Number(input.seq) > ackSeq);
    let state = cloneShip(authoritative);
    for (const input of pending) {
        const result = integrateShip(state, input, dt, bounds);
        state = result.state;
    }
    return { state, pending };
}
