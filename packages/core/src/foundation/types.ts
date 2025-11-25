/**
 * Core type definitions for shuimo-core
 *
 * This file contains all fundamental type definitions used throughout the library.
 */

// ============================================================================
// Basic Geometric Types
// ============================================================================

/**
 * 2D vector
 */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * 3D vector
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Bounding box for elements
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 2D transformation
 */
export interface Transform {
  translate: Vec2;
  rotate: number; // in radians
  scale: Vec2;
}

// ============================================================================
// Color Types
// ============================================================================

/**
 * RGB color representation
 */
export interface Color {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a?: number; // 0-1, optional alpha
}

/**
 * HSV color representation
 */
export interface ColorHSV {
  h: number; // 0-360
  s: number; // 0-1
  v: number; // 0-1
  a?: number; // 0-1, optional alpha
}

// ============================================================================
// Style Types
// ============================================================================

/**
 * Line cap style
 */
export type LineCap = 'butt' | 'round' | 'square';

/**
 * Line join style
 */
export type LineJoin = 'miter' | 'round' | 'bevel';

/**
 * Drawing style for rendering
 */
export interface DrawStyle {
  fillColor?: Color;
  strokeColor?: Color;
  strokeWidth?: number;
  lineCap?: LineCap;
  lineJoin?: LineJoin;
  opacity?: number;
  blur?: number;
}

/**
 * Brush effect parameters
 */
export interface BrushEffect {
  type: 'ink' | 'dry-brush' | 'wash' | 'outline';
  pressure?: number; // 0-1
  wetness?: number; // 0-1
  texture?: number; // 0-1
}

// ============================================================================
// Renderer Types
// ============================================================================

/**
 * Renderer type
 */
export type RendererType = 'canvas' | 'svg';

/**
 * Export format
 */
export type ExportFormat = 'png' | 'jpeg' | 'svg' | 'data-url';

/**
 * Render context
 */
export interface RenderContext {
  renderer: IRenderer;
  transform: Transform;
  style: DrawStyle;
}

/**
 * Base renderer interface
 */
export interface IRenderer {
  readonly type: RendererType;
  readonly width: number;
  readonly height: number;

  // Drawing methods
  drawPath(points: Vec2[], style: DrawStyle): void;
  drawPolygon(points: Vec2[], style: DrawStyle): void;
  drawCircle(center: Vec2, radius: number, style: DrawStyle): void;
  stroke(points: Vec2[], style: DrawStyle, brush?: BrushEffect): void;

  // Transform methods
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;

  // Export methods
  export(format: ExportFormat): Promise<string | Blob>;
  clear(): void;
}

// ============================================================================
// Element Types
// ============================================================================

/**
 * Element type identifier
 */
export type ElementType = string;

/**
 * Base element interface
 */
export interface IElement {
  readonly id: string;
  readonly type: ElementType;
  readonly bounds: BoundingBox;

  render(context: RenderContext): void;
  clone(): IElement;
  getBounds(): BoundingBox;
}

/**
 * Serializable interface
 */
export interface ISerializable {
  serialize(): SerializedElement;
}

/**
 * Serialized element data
 */
export interface SerializedElement {
  id: string;
  type: string;
  parameters: Record<string, unknown>;
  transform?: Transform;
  style?: DrawStyle;
}

// ============================================================================
// Parameter Types
// ============================================================================

/**
 * Parameter value types
 */
export type ParameterValue = number | string | boolean | Vec2 | Color;

/**
 * Parameter definition
 */
export interface ParameterDefinition<T = ParameterValue> {
  type: 'number' | 'string' | 'boolean' | 'vec2' | 'color';
  label?: string;
  description?: string;
  default: T;
  min?: T extends number ? number : never;
  max?: T extends number ? number : never;
  step?: T extends number ? number : never;
  options?: T extends string ? string[] : never;
}

/**
 * Parametric interface
 */
export interface IParametric {
  getParameter<T = ParameterValue>(key: string): T;
  setParameter<T = ParameterValue>(key: string, value: T): void;
  getParameterKeys(): string[];
}

// ============================================================================
// Random Types
// ============================================================================

/**
 * Pseudo-random number generator interface
 */
export interface IPRNG {
  random(): number;
  randomInt(min: number, max: number): number;
  randomRange(min: number, max: number): number;
  getSeed(): number;
  setSeed(seed: number): void;
}

// ============================================================================
// Noise Types
// ============================================================================

/**
 * Noise type
 */
export type NoiseType = 'perlin' | 'simplex';

/**
 * Noise generator interface
 */
export interface INoise {
  noise1D(x: number): number;
  noise2D(x: number, y: number): number;
  noise3D(x: number, y: number, z: number): number;
}

/**
 * FBM (Fractal Brownian Motion) options
 */
export interface FBMOptions {
  octaves?: number;
  lacunarity?: number;
  gain?: number;
  amplitude?: number;
  frequency?: number;
}

// ============================================================================
// Scene Types
// ============================================================================

/**
 * Layer interface
 */
export interface ILayer {
  readonly id: string;
  readonly name: string;
  visible: boolean;
  opacity: number;
  elements: IElement[];

  addElement(element: IElement): void;
  removeElement(id: string): void;
  render(context: RenderContext): void;
}

/**
 * Scene configuration
 */
export interface SceneConfig {
  width: number;
  height: number;
  backgroundColor?: Color;
  seed?: number;
}

/**
 * Serialized scene data
 */
export interface SerializedScene {
  version: string;
  config: SceneConfig;
  layers: SerializedLayer[];
}

/**
 * Serialized layer data
 */
export interface SerializedLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  elements: SerializedElement[];
}

// ============================================================================
// Plugin Types
// ============================================================================

/**
 * Plugin interface
 */
export interface IPlugin {
  readonly name: string;
  readonly version: string;

  install(core: unknown): void;
  uninstall(): void;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Constructor type
 */
export type Constructor<T = unknown> = new (...args: any[]) => T;

/**
 * Element constructor type
 */
export type ElementConstructor = Constructor<IElement>;

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Readonly deep type
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
