export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(other) {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  sub(other) {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  scale(scalar) {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  dot(other) {
    return this.x * other.x + this.y * other.y;
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

  clone() {
    return new Vector2(this.x, this.y);
  }

  static fromAngle(angle, length = 1) {
    return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length);
  }
}
