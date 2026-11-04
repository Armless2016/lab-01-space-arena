function wrappedDelta(a, b, size) {
    let delta = a - b;
    if (delta > size / 2)
        delta -= size;
    if (delta < -size / 2)
        delta += size;
    return delta;
}
/** Circle-circle collision in a toroidal arena (ships can wrap at the edges). */
export function circlesOverlap(a, b, width, height) {
    const dx = wrappedDelta(a.x, b.x, width);
    const dy = wrappedDelta(a.y, b.y, height);
    const radius = a.radius + b.radius;
    return dx * dx + dy * dy <= radius * radius;
}
export function squaredToroidalDistance(a, b, width, height) {
    const dx = wrappedDelta(a.x, b.x, width);
    const dy = wrappedDelta(a.y, b.y, height);
    return dx * dx + dy * dy;
}
