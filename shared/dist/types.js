// One generic constructor contains the deliberate assertion for all numeric brands.
function brandNumber(value) {
    return value; // The brand exists only at compile time; runtime validation happens at the boundary.
}
export function entityId(value) { return brandNumber(value); }
export function stepNumber(value) { return brandNumber(value); }
export function inputSeq(value) { return brandNumber(value); }
export function assertNever(value, message = 'Unhandled discriminated union member') {
    throw new Error(`${message}: ${String(value)}`);
}
