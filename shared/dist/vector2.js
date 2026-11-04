/** Immutable vector value: every operation returns a new Vector2. */
export class Vector2 {
    x;
    y;
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    add(other) {
        return new Vector2(this.x + other.x, this.y + other.y);
    }
    subtract(other) {
        return new Vector2(this.x - other.x, this.y - other.y);
    }
    scale(factor) {
        return new Vector2(this.x * factor, this.y * factor);
    }
    get length() {
        return Math.hypot(this.x, this.y);
    }
    normalized() {
        const magnitude = this.length;
        return magnitude === 0 ? new Vector2(0, 0) : this.scale(1 / magnitude);
    }
    static fromAngle(angle, magnitude = 1) {
        return new Vector2(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);
    }
}
