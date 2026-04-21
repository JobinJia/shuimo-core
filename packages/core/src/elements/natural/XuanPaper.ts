/**
 * XuanPaper - Chinese Rice Paper / Xuan Paper Generator
 *
 * Public compatibility wrapper around the modular Xuan paper pipeline.
 */

import { renderXuanPaperCanvas } from "./xuan-paper/canvas-renderer";
import { buildXuanPaperScene } from "./xuan-paper/model";
import { DEFAULT_BASE_COLOR, GoldFleckColors, XuanPaperColors } from "./xuan-paper/presets";
import { renderXuanPaperSVG } from "./xuan-paper/svg-renderer";
import type { XuanPaperOptions } from "./xuan-paper/types";

export type { XuanPaperOptions } from "./xuan-paper/types";
export { XuanPaperColors, GoldFleckColors } from "./xuan-paper/presets";

export class XuanPaper {
  static generate(options: XuanPaperOptions = {}): HTMLCanvasElement {
    return renderXuanPaperCanvas(
      buildXuanPaperScene({
        ...options,
        baseColor: options.baseColor ?? DEFAULT_BASE_COLOR,
        mode: "canvas",
      }),
    );
  }

  static generateSVG(options: XuanPaperOptions = {}): SVGSVGElement {
    return renderXuanPaperSVG(
      buildXuanPaperScene({
        ...options,
        baseColor: options.baseColor ?? DEFAULT_BASE_COLOR,
        mode: "svg",
      }),
    );
  }

  static generateDataURL(options: XuanPaperOptions = {}): string {
    return this.generate(options).toDataURL("image/png");
  }

  static createPattern(id: string, options: XuanPaperOptions = {}): SVGPatternElement {
    const { width = 512, height = 512 } = options;
    const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    pattern.setAttribute("id", id);
    pattern.setAttribute("x", "0");
    pattern.setAttribute("y", "0");
    pattern.setAttribute("width", String(width));
    pattern.setAttribute("height", String(height));
    pattern.setAttribute("patternUnits", "userSpaceOnUse");

    const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
    image.setAttribute("width", String(width));
    image.setAttribute("height", String(height));
    image.setAttribute("href", this.generateDataURL({ ...options, width, height }));
    pattern.appendChild(image);

    return pattern;
  }
}

export function xuanPaper(options: XuanPaperOptions = {}): HTMLCanvasElement {
  return XuanPaper.generate(options);
}

export function xuanPaperSVG(options: XuanPaperOptions = {}): SVGSVGElement {
  return XuanPaper.generateSVG(options);
}
