export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  clone() {
    return new Vector2(this.x, this.y);
  }

  add(other) {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  sub(other) {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  scale(factor) {
    return new Vector2(this.x * factor, this.y * factor);
  }

  length() {
    return Math.hypot(this.x, this.y);
  }

  normalized() {
    const length = this.length();
    return length > 0 ? this.scale(1 / length) : new Vector2();
  }

  distanceTo(other) {
    return this.sub(other).length();
  }

  angle() {
    return Math.atan2(this.y, this.x);
  }

  static fromAngle(angle, magnitude = 1) {
    return new Vector2(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);
  }
}
