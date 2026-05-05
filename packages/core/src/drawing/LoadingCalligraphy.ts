import {
  fmt,
  escapeAttr,
  escapeText,
  positiveNumber,
  makeIdSuffix,
  makeLoadingDefs,
  DEFAULT_LOADING_WIDTH,
  DEFAULT_LOADING_HEIGHT,
  DEFAULT_LOADING_SEED,
  DEFAULT_LOADING_DURATION,
  DEFAULT_LOADING_INK_COLOR,
  DEFAULT_LOADING_PAPER_COLOR,
} from "../utils/svg";
import type { ShuimoLoadingOptions } from "./ShuimoLoading";

/**
 * Generate an animated SVG loading mark: a calligraphic brush
 * draws the Taiji (yin-yang) fish pattern, stroke by stroke.
 *
 * Self-contained SVG with SMIL animation — no runtime JS required.
 */
export function generateCalligraphyLoadingSVG(options: ShuimoLoadingOptions = {}): string {
  const width = positiveNumber(options.width, DEFAULT_LOADING_WIDTH);
  const height = positiveNumber(options.height, DEFAULT_LOADING_HEIGHT);
  const duration = positiveNumber(options.duration, DEFAULT_LOADING_DURATION);
  const inkColor = escapeAttr(options.inkColor ?? DEFAULT_LOADING_INK_COLOR);
  const paperColor = escapeAttr(options.paperColor ?? DEFAULT_LOADING_PAPER_COLOR);
  const title = escapeText(options.title ?? "Loading");
  const reducedMotion = options.reducedMotion ?? false;
  const seed = options.seed ?? DEFAULT_LOADING_SEED;

  const idSuffix = makeIdSuffix(seed, width, height);
  const scale = Math.min(width, height) / 160;
  const defs = makeLoadingDefs(idSuffix, seed, scale, "calligraphy");

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.38;

  const fishPath = makeTaijiFishPath(radius);
  const fishLen = 2 * Math.PI * radius;
  const fishGradId = `calligraphy-fish-grad-${idSuffix}`;

  const eyeRadius = radius * 0.12;
  const eyeCircleLen = 2 * Math.PI * eyeRadius;

  const eyeHookPath = makeEyeHookPath(-radius * 0.44, -radius * 0.36, eyeRadius);
  const eyeHookLen = eyeRadius * 2.8;

  const sw = fmt(2.6 * scale);
  const dashOffsetAnim = (len: number, begin: number) =>
    reducedMotion
      ? ""
      : `<animate attributeName="stroke-dashoffset" values="${fmt(len)};0;${fmt(-len)}" dur="${fmt(duration)}s" begin="${fmt(begin)}s" repeatCount="indefinite"/>`;

  const widthAnim = reducedMotion
    ? ""
    : `<animate attributeName="stroke-width" values="${fmt(2.0 * scale)};${fmt(3.0 * scale)};${fmt(2.0 * scale)}" dur="${fmt(duration / 2)}s" repeatCount="indefinite"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}" role="img" aria-labelledby="${defs.titleId}">
  <title id="${defs.titleId}">${title}</title>
  <defs>
    ${defs.filterDefs}
    <radialGradient id="${fishGradId}" cx="38%" cy="40%" r="58%">
      <stop offset="0%" stop-color="#333" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${inkColor}" stop-opacity="0.55"/>
    </radialGradient>
  </defs>
  <rect width="${fmt(width)}" height="${fmt(height)}" fill="${paperColor}" filter="url(#${defs.paperId})"/>
  <g style="mix-blend-mode:multiply">
    <g transform="translate(${fmt(cx)} ${fmt(cy)})">
      <g filter="url(#${defs.inkFilterId})">
        <g filter="url(#${defs.edgeFilterId})">
          <circle cx="0" cy="0" r="${fmt(radius)}" fill="${paperColor}" opacity="0.35"/>
          <path d="${fishPath}" fill="url(#${fishGradId})" opacity="0.5"/>
          <path d="${fishPath}" fill="none" stroke="${inkColor}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${fmt(fishLen)} ${fmt(fishLen * 0.25)}" opacity="0.9">
            ${dashOffsetAnim(fishLen, 0)}
            ${widthAnim}
          </path>
          <circle cx="${fmt(-radius * 0.44)}" cy="${fmt(-radius * 0.36)}" r="${fmt(eyeRadius)}" fill="${inkColor}" opacity="0.25"/>
          <circle cx="${fmt(-radius * 0.44)}" cy="${fmt(-radius * 0.36)}" r="${fmt(eyeRadius)}" fill="none" stroke="${inkColor}" stroke-width="${fmt(1.6 * scale)}" stroke-dasharray="${fmt(eyeCircleLen)} ${fmt(eyeCircleLen * 0.25)}" opacity="0.9">
            ${dashOffsetAnim(eyeCircleLen, duration * 0.25)}
          </circle>
          <path d="${eyeHookPath}" fill="none" stroke="${inkColor}" stroke-width="${fmt(1.0 * scale)}" stroke-linecap="round" stroke-dasharray="${fmt(eyeHookLen)} ${fmt(eyeHookLen * 0.25)}" opacity="0.6">
            ${dashOffsetAnim(eyeHookLen, duration * 0.5)}
          </path>
          <circle cx="${fmt(radius * 0.42)}" cy="${fmt(radius * 0.34)}" r="${fmt(eyeRadius)}" fill="${paperColor}" opacity="0.25"/>
          <circle cx="${fmt(radius * 0.42)}" cy="${fmt(radius * 0.34)}" r="${fmt(eyeRadius)}" fill="none" stroke="${inkColor}" stroke-width="${fmt(1.6 * scale)}" stroke-dasharray="${fmt(eyeCircleLen)} ${fmt(eyeCircleLen * 0.25)}" opacity="0.88">
            ${dashOffsetAnim(eyeCircleLen, duration * 0.4)}
          </circle>
        </g>
      </g>
    </g>
  </g>
</svg>`;
}

export const calligraphyLoading = generateCalligraphyLoadingSVG;

function makeTaijiFishPath(r: number): string {
  const h = r / 2;
  return [
    `M 0 ${fmt(-r)}`,
    `A ${fmt(r)} ${fmt(r)} 0 0 1 0 ${fmt(r)}`,
    `A ${fmt(h)} ${fmt(h)} 0 0 1 0 0`,
    `A ${fmt(h)} ${fmt(h)} 0 0 0 0 ${fmt(-r)}`,
    "Z",
  ].join(" ");
}

function makeEyeHookPath(x: number, y: number, rr: number): string {
  return [
    `M ${fmt(x - rr * 0.7)} ${fmt(y - rr * 0.18)}`,
    `C ${fmt(x - rr * 0.85)} ${fmt(y + rr * 0.5)} ${fmt(x - rr * 0.18)} ${fmt(y + rr * 0.92)} ${fmt(x + rr * 0.46)} ${fmt(y + rr * 0.62)}`,
  ].join(" ");
}
