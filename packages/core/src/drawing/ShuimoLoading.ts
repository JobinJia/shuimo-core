import { PRNG } from "../foundation/random";
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

export interface ShuimoLoadingOptions {
  /** SVG width in user units. */
  width?: number;
  /** SVG height in user units. */
  height?: number;
  /** Deterministic seed for organic edge variation. */
  seed?: number | string;
  /** Animation cycle duration in seconds. */
  duration?: number;
  /** Main ink color. */
  inkColor?: string;
  /** Xuan-paper background color. */
  paperColor?: string;
  /** @deprecated Accent color is kept for compatibility and is no longer rendered. */
  accentColor?: string;
  /** Accessible SVG title. */
  title?: string;
  /** Emit the same drawing without SMIL animation. */
  reducedMotion?: boolean;
}

/**
 * Generate an animated SVG loading mark in the Shuimo visual language.
 *
 * The mark is intentionally self-contained: it uses SVG filters and SMIL
 * animation only, so callers can embed the returned string without runtime JS.
 */
export function generateShuimoLoadingSVG(options: ShuimoLoadingOptions = {}): string {
  const width = positiveNumber(options.width, DEFAULT_LOADING_WIDTH);
  const height = positiveNumber(options.height, DEFAULT_LOADING_HEIGHT);
  const duration = positiveNumber(options.duration, DEFAULT_LOADING_DURATION);
  const inkColor = escapeAttr(options.inkColor ?? DEFAULT_LOADING_INK_COLOR);
  const paperColor = escapeAttr(options.paperColor ?? DEFAULT_LOADING_PAPER_COLOR);
  const title = escapeText(options.title ?? "Loading");
  const reducedMotion = options.reducedMotion ?? false;
  const seed = options.seed ?? DEFAULT_LOADING_SEED;

  const rng = new PRNG();
  rng.seed(seed);

  const idSuffix = makeIdSuffix(seed, width, height);
  const scale = Math.min(width, height) / 160;
  const defs = makeLoadingDefs(idSuffix, seed, scale);
  const clipId = `shuimo-circle-${idSuffix}`;

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.38;
  const darkFishPath = makeTaijiFishPath(radius);
  const eyeRadius = radius * 0.12;
  const darkEye = { x: -radius * 0.44, y: -radius * 0.36 };
  const lightEye = { x: radius * 0.42, y: radius * 0.34 };
  const initialRotation = -90;
  const taijiTransform = reducedMotion ? ` transform="rotate(${initialRotation})"` : "";

  const animation = reducedMotion
    ? ""
    : `
      <animateTransform attributeName="transform" type="rotate" values="${initialRotation};${initialRotation + 360}" dur="${fmt(duration)}s" repeatCount="indefinite"/>`;

  const eyeAnimation = reducedMotion
    ? ""
    : `
        <animate attributeName="opacity" values="0.78;1;0.78" dur="${fmt(duration / 2)}s" repeatCount="indefinite"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}" role="img" aria-labelledby="${defs.titleId}">
  <title id="${defs.titleId}">${title}</title>
  <defs>
    ${defs.filterDefs}
    <clipPath id="${clipId}">
      <circle cx="0" cy="0" r="${fmt(radius)}"/>
    </clipPath>
  </defs>
  <rect width="${fmt(width)}" height="${fmt(height)}" fill="${paperColor}" filter="url(#${defs.paperId})"/>
  <g style="mix-blend-mode:multiply">
    <g transform="translate(${fmt(cx)} ${fmt(cy)})">
      <g filter="url(#${defs.inkFilterId})"${taijiTransform}>
        <g filter="url(#${defs.edgeFilterId})">
          <g clip-path="url(#${clipId})">
            <circle cx="0" cy="0" r="${fmt(radius)}" fill="${paperColor}" opacity="0.96"/>
            <path d="${darkFishPath}" fill="${inkColor}" opacity="0.92"/>
          </g>
        </g>
        <circle cx="${fmt(darkEye.x)}" cy="${fmt(darkEye.y)}" r="${fmt(eyeRadius)}" fill="${inkColor}" opacity="0.96">${eyeAnimation}
        </circle>
        <path d="${makeEyeHookPath(darkEye.x, darkEye.y, eyeRadius)}" fill="none" stroke="${inkColor}" stroke-width="${fmt(1.1 * scale)}" stroke-linecap="round" opacity="0.58"/>
        <circle cx="${fmt(lightEye.x)}" cy="${fmt(lightEye.y)}" r="${fmt(eyeRadius)}" fill="${paperColor}" opacity="0.96">${eyeAnimation}
        </circle>
        ${animation}
      </g>
    </g>
  </g>
</svg>`;
}

export const shuimoLoading = generateShuimoLoadingSVG;

function makeTaijiFishPath(radius: number): string {
  const half = radius / 2;
  return [
    `M 0 ${fmt(-radius)}`,
    `A ${fmt(radius)} ${fmt(radius)} 0 0 1 0 ${fmt(radius)}`,
    `A ${fmt(half)} ${fmt(half)} 0 0 1 0 0`,
    `A ${fmt(half)} ${fmt(half)} 0 0 0 0 ${fmt(-radius)}`,
    "Z",
  ].join(" ");
}

function makeEyeHookPath(x: number, y: number, radius: number): string {
  return [
    `M ${fmt(x - radius * 0.7)} ${fmt(y - radius * 0.18)}`,
    `C ${fmt(x - radius * 0.85)} ${fmt(y + radius * 0.5)} ${fmt(x - radius * 0.18)} ${fmt(y + radius * 0.92)} ${fmt(x + radius * 0.46)} ${fmt(y + radius * 0.62)}`,
  ].join(" ");
}
