/**
 * Shared message protocol for the stamp glyph-font worker.
 *
 * The worker fetches/parses the font (woff2 brotli decode included) off the
 * main thread, then returns a precomputed bundle of glyph commands and metrics
 * for the requested character set. The main thread reconstructs a `GlyphFont`
 * surface from this bundle without ever calling fontkit on the UI thread.
 */

import type { NormalizedCommand } from "./glyphPath";

export interface GlyphFontWorkerRequest {
  id: number;
  /** Either fontUrl or fontData must be provided. fontData is preferred (no fetch). */
  fontUrl?: string;
  fontData?: ArrayBuffer;
  /** Distinct characters whose paths/metrics the caller will need. */
  chars: string[];
}

export interface GlyphData {
  /** The character (1+ code units). */
  char: string;
  /** Advance width in font units (matches fontkit `glyph.advanceWidth`). */
  advanceWidth: number;
  /**
   * Pre-scaled commands at fontSize === unitsPerEm so the main thread can
   * rescale by `fontSize / unitsPerEm` without re-running fontkit. The Y axis
   * is already flipped to SVG space (y-down), matching `glyphPath.loadFont`.
   */
  commandsAtUnitsPerEm: NormalizedCommand[];
}

export interface GlyphFontBundle {
  unitsPerEm: number;
  glyphs: GlyphData[];
}

export type GlyphFontWorkerResponse =
  | { id: number; bundle: GlyphFontBundle }
  | { id: number; error: string };
