import type { SealScript } from "../types";

/**
 * Pre-tuned angularize parameters per 篆体 (seal-script style). The user
 * picks a `script`, this drives the geometric chunkiness; `carving.intensity`
 * still overrides `intensity` when explicitly passed.
 *
 * Visual intent:
 *   - 金文 (jinwen): bronze-inscription style — most rounded, smoothest curves
 *   - 大篆 (dazhuan): pre-Qin large seal — moderate angularity
 *   - 小篆 (xiaozhuan): Qin small seal — V2's default, balanced stone-cut
 *   - 九叠篆 (jiudiezhuan): "9-fold" — extreme angular folding, auto-stretch
 *   - custom: zero baseline; user controls every knob via `carving.intensity`
 *     and (eventually) bespoke angularize options
 */
export interface ScriptProfile {
  /** Default `carving.intensity` when the caller doesn't supply one. */
  intensity: number;
  /** Default angularize grid (user units). Larger = blockier. */
  grid: number;
  /** Default jitter amplitude (multiplied by intensity at runtime). */
  jitter: number;
  /** Default Bezier control-point pull (0..1). Larger = more angular. */
  pull: number;
  /** When true, the seal pipeline defaults `layout.stretch` to true. */
  autoStretch: boolean;
}

const PROFILES: Record<SealScript, ScriptProfile> = {
  jinwen: { intensity: 0.3, grid: 1.6, jitter: 0.5, pull: 0.2, autoStretch: false },
  dazhuan: { intensity: 0.45, grid: 1.5, jitter: 0.7, pull: 0.3, autoStretch: false },
  xiaozhuan: { intensity: 0.6, grid: 1.4, jitter: 0.9, pull: 0.42, autoStretch: false },
  jiudiezhuan: { intensity: 1.0, grid: 1.2, jitter: 1.2, pull: 0.6, autoStretch: true },
  // `custom` — zero baseline; users layer on top via carving.intensity etc.
  custom: { intensity: 0, grid: 1.4, jitter: 0.9, pull: 0.42, autoStretch: false },
};

export function getScriptProfile(script: SealScript | undefined): ScriptProfile | null {
  if (!script) return null;
  return PROFILES[script] ?? null;
}
