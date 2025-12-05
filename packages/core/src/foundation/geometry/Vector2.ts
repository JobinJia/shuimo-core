/**
 * 2D Vector class for geometric operations
 */
export class Vector2 {
  constructor(
    public x: number,
    public y: number
  ) {}

  /**
   * Create a Vector2 from a Point
   */
  static fromPoint(point: [number, number]): Vector2 {
    return new Vector2(point[0], point[1])
  }

  /**
   * Convert to Point tuple
   */
  toPoint(): [number, number] {
    return [this.x, this.y]
  }

  /**
   * Add two vectors
   */
  add(other: Vector2): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y)
  }

  /**
   * Subtract two vectors
   */
  sub(other: Vector2): Vector2 {
    return new Vector2(this.x - other.x, this.y - other.y)
  }

  /**
   * Multiply vector by scalar
   */
  multiply(scalar: number): Vector2 {
    return new Vector2(this.x * scalar, this.y * scalar)
  }

  /**
   * Divide vector by scalar
   */
  divide(scalar: number): Vector2 {
    if (scalar === 0) throw new Error('Division by zero')
    return new Vector2(this.x / scalar, this.y / scalar)
  }

  /**
   * Calculate vector length
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y)
  }

  /**
   * Calculate distance to another vector
   */
  distance(other: Vector2): number {
    const dx = this.x - other.x
    const dy = this.y - other.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Normalize vector to unit length
   */
  normalize(): Vector2 {
    const len = this.length()
    if (len === 0) return new Vector2(0, 0)
    return this.divide(len)
  }

  /**
   * Dot product
   */
  dot(other: Vector2): number {
    return this.x * other.x + this.y * other.y
  }

  /**
   * Linear interpolation between two vectors
   */
  static lerp(a: Vector2, b: Vector2, t: number): Vector2 {
    return new Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)
  }

  /**
   * Create a copy of the vector
   */
  clone(): Vector2 {
    return new Vector2(this.x, this.y)
  }

  /**
   * Check if two vectors are equal
   */
  equals(other: Vector2, epsilon: number = 0.0001): boolean {
    return Math.abs(this.x - other.x) < epsilon && Math.abs(this.y - other.y) < epsilon
  }

  /**
   * Rotate vector by angle (in radians)
   */
  rotate(angle: number): Vector2 {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return new Vector2(this.x * cos - this.y * sin, this.x * sin + this.y * cos)
  }

  /**
   * Get the angle of this vector in radians
   */
  angle(): number {
    return Math.atan2(this.y, this.x)
  }

  /**
   * Convert to string for debugging
   */
  toString(): string {
    return `Vector2(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`
  }

  /**
   * Create a zero vector
   */
  static zero(): Vector2 {
    return new Vector2(0, 0)
  }

  /**
   * Create a unit vector pointing right
   */
  static right(): Vector2 {
    return new Vector2(1, 0)
  }

  /**
   * Create a unit vector pointing up
   */
  static up(): Vector2 {
    return new Vector2(0, 1)
  }
}
