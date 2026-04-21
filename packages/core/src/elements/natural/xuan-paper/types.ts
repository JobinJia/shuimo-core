export type GoldDistribution = "poisson" | "random";

export interface XuanPaperOptions {
  width?: number;
  height?: number;
  baseColor?: [number, number, number];
  fiberDensity?: number;
  fiberScale?: number;
  textureIntensity?: number;
  grainDensity?: number;
  age?: number;
  deckleEdge?: boolean;
  deckleRoughness?: number;
  seed?: number;
  mode?: "canvas" | "svg";
  goldFlecks?: boolean;
  goldDensity?: number;
  goldSize?: [number, number];
  goldColor?: [number, number, number];
  goldClustering?: number;
  goldDistribution?: GoldDistribution;
}

export interface NormalizedXuanPaperOptions {
  width: number;
  height: number;
  baseColor: [number, number, number];
  fiberDensity: number;
  fiberScale: number;
  textureIntensity: number;
  grainDensity: number;
  age: number;
  deckleEdge: boolean;
  deckleRoughness: number;
  seed: number;
  mode: "canvas" | "svg";
  goldFlecks: boolean;
  goldDensity: number;
  goldSize: [number, number];
  goldColor: [number, number, number];
  goldClustering: number;
  goldDistribution: GoldDistribution;
}

export type XuanPaperKind = "raw" | "halfSized" | "sized";

export interface XuanPaperProfile {
  kind: XuanPaperKind;
  warmth: number;
  fiberContrast: number;
  fiberLengthMultiplier: number;
  formationContrast: number;
  grainSoftness: number;
  particleContrast: number;
  patinaStrength: number;
  deckleSoftness: number;
  absorbency: number;
}

export interface PaperPoint {
  x: number;
  y: number;
}

export interface FiberStroke {
  points: PaperPoint[];
  width: number;
  color: [number, number, number];
  alpha: number;
}

export interface GrainParticle {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation: number;
  color: [number, number, number];
  alpha: number;
}

export type GoldPathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "Q"; cpx: number; cpy: number; x: number; y: number }
  | { type: "Z" };

export interface GoldFleck {
  commands: GoldPathCommand[];
  copies: PaperPoint[];
  color: [number, number, number];
  alpha: number;
}

export interface DeckleOutline {
  top: number[];
  right: number[];
  bottom: number[];
  left: number[];
}

export interface PaperSeeds {
  tone: number;
  formation: number;
  detail: number;
  fibers: number;
  particles: number;
  aging: number;
  gold: number;
  deckle: number;
}

export interface XuanPaperScene {
  options: NormalizedXuanPaperOptions;
  profile: XuanPaperProfile;
  seeds: PaperSeeds;
  fibers: FiberStroke[];
  particles: GrainParticle[];
  goldFlecks: GoldFleck[];
  deckleOutline: DeckleOutline | null;
}
