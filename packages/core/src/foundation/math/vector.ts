/**
 * Vector mathematics
 *
 * Provides 2D and 3D vector classes with common operations
 */

import type { Vec2, Vec3 } from '../types';

// ============================================================================
// Vector2 Class
// ============================================================================

/**
 * 2D Vector class with common vector operations
 */
export class Vector2 implements Vec2 {
  constructor(public x: number = 0, public y: number = 0) {}

  // ========== Factory methods ==========

  static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  static one(): Vector2 {
    return new Vector2(1, 1);
  }

  static fromVec2(v: Vec2): Vector2 {
    return new Vector2(v.x, v.y);
  }

  static fromAngle(angle: number, length: number = 1): Vector2 {
    return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  // ========== Basic operations ==========

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(v: Vec2): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  // ========== Arithmetic operations ==========

  add(v: Vec2): Vector2 {
    return new Vector2(this.x + v.x, this.y + v.y);
  }

  addScalar(s: number): Vector2 {
    return new Vector2(this.x + s, this.y + s);
  }

  sub(v: Vec2): Vector2 {
    return new Vector2(this.x - v.x, this.y - v.y);
  }

  subScalar(s: number): Vector2 {
    return new Vector2(this.x - s, this.y - s);
  }

  multiply(v: Vec2): Vector2 {
    return new Vector2(this.x * v.x, this.y * v.y);
  }

  multiplyScalar(s: number): Vector2 {
    return new Vector2(this.x * s, this.y * s);
  }

  divide(v: Vec2): Vector2 {
    return new Vector2(this.x / v.x, this.y / v.y);
  }

  divideScalar(s: number): Vector2 {
    return new Vector2(this.x / s, this.y / s);
  }

  negate(): Vector2 {
    return new Vector2(-this.x, -this.y);
  }

  // ========== Geometric operations ==========

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  distance(v: Vec2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  distanceSquared(v: Vec2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  normalize(): Vector2 {
    const len = this.length();
    if (len === 0) return new Vector2(0, 0);
    return this.divideScalar(len);
  }

  dot(v: Vec2): number {
    return this.x * v.x + this.y * v.y;
  }

  cross(v: Vec2): number {
    // 2D cross product returns scalar (z component)
    return this.x * v.y - this.y * v.x;
  }

  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  angleTo(v: Vec2): number {
    const angle = Math.atan2(v.y, v.x) - Math.atan2(this.y, this.x);
    return angle;
  }

  rotate(angle: number): Vector2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  lerp(v: Vec2, t: number): Vector2 {
    return new Vector2(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t
    );
  }

  // ========== Utility ==========

  equals(v: Vec2, epsilon: number = 1e-10): boolean {
    return (
      Math.abs(this.x - v.x) < epsilon &&
      Math.abs(this.y - v.y) < epsilon
    );
  }

  toString(): string {
    return `Vector2(${this.x}, ${this.y})`;
  }

  toArray(): [number, number] {
    return [this.x, this.y];
  }

  toObject(): Vec2 {
    return { x: this.x, y: this.y };
  }
}

// ============================================================================
// Vector3 Class
// ============================================================================

/**
 * 3D Vector class with common vector operations
 */
export class Vector3 implements Vec3 {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}

  // ========== Factory methods ==========

  static zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }

  static one(): Vector3 {
    return new Vector3(1, 1, 1);
  }

  static fromVec3(v: Vec3): Vector3 {
    return new Vector3(v.x, v.y, v.z);
  }

  static fromVec2(v: Vec2, z: number = 0): Vector3 {
    return new Vector3(v.x, v.y, z);
  }

  // ========== Basic operations ==========

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(v: Vec3): this {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  // ========== Arithmetic operations ==========

  add(v: Vec3): Vector3 {
    return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  addScalar(s: number): Vector3 {
    return new Vector3(this.x + s, this.y + s, this.z + s);
  }

  sub(v: Vec3): Vector3 {
    return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  subScalar(s: number): Vector3 {
    return new Vector3(this.x - s, this.y - s, this.z - s);
  }

  multiply(v: Vec3): Vector3 {
    return new Vector3(this.x * v.x, this.y * v.y, this.z * v.z);
  }

  multiplyScalar(s: number): Vector3 {
    return new Vector3(this.x * s, this.y * s, this.z * s);
  }

  divide(v: Vec3): Vector3 {
    return new Vector3(this.x / v.x, this.y / v.y, this.z / v.z);
  }

  divideScalar(s: number): Vector3 {
    return new Vector3(this.x / s, this.y / s, this.z / s);
  }

  negate(): Vector3 {
    return new Vector3(-this.x, -this.y, -this.z);
  }

  // ========== Geometric operations ==========

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  lengthSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  distance(v: Vec3): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  distanceSquared(v: Vec3): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }

  normalize(): Vector3 {
    const len = this.length();
    if (len === 0) return new Vector3(0, 0, 0);
    return this.divideScalar(len);
  }

  dot(v: Vec3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v: Vec3): Vector3 {
    return new Vector3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  lerp(v: Vec3, t: number): Vector3 {
    return new Vector3(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t,
      this.z + (v.z - this.z) * t
    );
  }

  /**
   * Project this vector onto 2D plane (perspective projection)
   * @param fov Field of view (distance from camera)
   * @param centerX Center X coordinate
   * @param centerY Center Y coordinate
   */
  project(fov: number = 500, centerX: number = 0, centerY: number = 0): Vec2 {
    const z = this.z + fov;
    const scale = fov / z;
    return {
      x: this.x * scale + centerX,
      y: this.y * scale + centerY
    };
  }

  // ========== Utility ==========

  equals(v: Vec3, epsilon: number = 1e-10): boolean {
    return (
      Math.abs(this.x - v.x) < epsilon &&
      Math.abs(this.y - v.y) < epsilon &&
      Math.abs(this.z - v.z) < epsilon
    );
  }

  toString(): string {
    return `Vector3(${this.x}, ${this.y}, ${this.z})`;
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  toObject(): Vec3 {
    return { x: this.x, y: this.y, z: this.z };
  }

  toVec2(): Vec2 {
    return { x: this.x, y: this.y };
  }
}
