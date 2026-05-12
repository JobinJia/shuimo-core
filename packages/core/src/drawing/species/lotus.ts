import { BBS, Layer, hsv, mapval, normRand, pnoise } from "../FlowerCanvas";
import type { SpeciesDrawOpts } from "./index";

const PI = Math.PI;
const sin = Math.sin;
const cos = Math.cos;

// ── Approach ─────────────────────────────────────────────
//
// Previous versions reused FlowerCanvas's leaf()/stem() primitives — those
// produce tubified per-facet polygon shading, a "vector watercolor" look
// that can't reach the wet-ink density / soft-edge feel of a 水墨 lotus.
//
// This version skips that pipeline entirely and renders with three native
// canvas tools: createRadialGradient / createLinearGradient (for internal
// value variation), ctx.filter = "blur(Npx)" (soft brush edges), and a
// `multiply` blend when blitting the ink layer (overlapping leaves add
// density). Each leaf is one noise-perturbed elliptical blob — a single
// brush stamp — with optional darker streak suggesting brush direction.

// ── Constants ────────────────────────────────────────────

const CWID = 1200;

// Cluster of leaves occupies the lower portion; flower sits in upper third.
const CLUSTER_X_MIN_FRAC = 0.08;
const CLUSTER_X_MAX_FRAC = 0.95;
const CLUSTER_Y_MIN = CWID * 0.5;
const CLUSTER_Y_MAX = CWID * 0.92;
const Y_FLOWER_MIN = CWID * 0.12;
const Y_FLOWER_MAX = CWID * 0.3;
const X_FLOWER_MIN_FRAC = 0.18;
const X_FLOWER_MAX_FRAC = 0.78;

// Leaves
const LEAF_COUNT_MIN = 12;
const LEAF_COUNT_MAX = 18;
const LEAF_RADIUS_MIN = 70;
const LEAF_RADIUS_MAX = 200;
// Bias toward round (lotus pad is circular when seen top-down); allow some
// oblique compression but never as flat as the v1 elongated leaves.
const LEAF_AXIS_RATIO_MIN = 0.6;
const LEAF_AXIS_RATIO_MAX = 1.0;
const LEAF_NOISE = 0.14;
const LEAF_HUE = 215;
const LEAF_BLUR_PX = 2.4;
const LEAF_VAL_DARK_MIN = 0.04;
const LEAF_VAL_DARK_MAX = 0.18;
const LEAF_VAL_LIGHT_MIN = 0.32;
const LEAF_VAL_LIGHT_MAX = 0.55;
const LEAF_ALPHA_NEAR = 0.95;
const LEAF_ALPHA_FAR = 0.32;
const LEAF_STREAK_CHANCE = 0.45;

// Stems
//
// Each leaf and each flower has its own stem that runs from the anchor
// point down to (just below) the canvas bottom. Stems are rendered FIRST
// on the ink layer so leaves multiply over them — visible portions are the
// segments below the leaf cluster, plus the visible flower stems above it.
const STEM_HUE = 0;
const STEM_SAT = 0;
const STEM_VAL = 0.13;
const STEM_BASE_WIDTH = 14;
const STEM_MIN_WIDTH_FRAC = 0.65;
// Bigger bend + amplitude so stems read as visibly curved/wavy.
const STEM_BEND_RANGE_PX = 80;
const STEM_BOTTOM_OVERSHOOT = 30;
const STEM_NOISE_FREQ = 3.2;
const STEM_NOISE_FREQ_HI = 9;
const STEM_WOBBLE_AMPLITUDE_PX = 9;
const STEM_WOBBLE_FREQ = 3.5;

// Prickles — small transverse whiskers / dots along the stem axis (the
// micro-spines of real lotus stems). Position is along-length perlin-
// driven so they cluster, not uniform. Length and side direction also
// noise-driven.
const PRICKLE_DENSITY_FREQ = 2.5;
const PRICKLE_DENSITY_THRESHOLD = 0.35;
const PRICKLE_COUNT_PER_STEM_MIN = 14;
const PRICKLE_COUNT_PER_STEM_MAX = 28;
const PRICKLE_LEN_MIN = 1.6;
const PRICKLE_LEN_MAX = 4.5;
const PRICKLE_VAL = 0.04;
const PRICKLE_ALPHA_MIN = 0.55;
const PRICKLE_ALPHA_MAX = 0.95;
// Hair-stroke decomposition — model the brush as a bundle of N parallel
// "hair" strokes side-by-side. Each hair has its own perlin-driven alpha
// along the stem axis; when most hairs are at high alpha, the stem reads
// as a solid mass; when many hairs dip low, the surviving hairs show as
// the discrete parallel black lines that define 飞白 (flying white).
//
// This is closer to how a real brush dries: the bristles separate and
// each one leaves its own trail, rather than a uniform stem with random
// gaps cut out.
const HAIR_COUNT = 7; // fewer hairs → each is fatter and clearly visible
const HAIR_ALPHA_MIN = 0.1;
const HAIR_ALPHA_MAX = 1.0;
const HAIR_ALPHA_FREQ_LOW = 2.4;
const HAIR_ALPHA_FREQ_HIGH = 8.5;
const HAIR_LINE_WIDTH = 2.0; // wider so the carved slit reads at canvas scale
const HAIR_BLUR_PX = 0.3;
const HAIR_DRYNESS_MIN = 0.55; // most hairs are at least somewhat dry
const HAIR_DRYNESS_MAX = 1.05;
const HAIR_PRESENCE_THRESHOLD = 0.18; // low → easy to trigger an erase

// Number of bloomed flowers per composition. Each gets its own stem.
const FLOWER_COUNT_MIN = 2;
const FLOWER_COUNT_MAX = 3;
const FLOWER_X_SPREAD_MIN_FRAC = 0.13; // min horizontal gap between flowers (fraction of cwid)

// Flower (v7 — 3D yaw/pitch petal arrangement)
//
// The previous flat-fan model failed because real lotuses are not flat. We
// generate ~14 petals each with a yaw (around vertical axis) and pitch
// (back-tilt). Petals project to screen by foreshortening: width shrinks
// when the petal is edge-on (yaw near ±π/2), vertical reach shrinks when
// the petal lies down (high pitch). Sorting by cos(yaw) renders back-to-
// front, producing the cup-of-stacked-petals silhouette of the reference.
const PETAL_COUNT_MIN = 9;
const PETAL_COUNT_MAX = 12;
const PETAL_LENGTH = 195;
const PETAL_WIDTH = 80;
const PETAL_PITCH_MIN = 0.04 * PI;
const PETAL_PITCH_MAX = 0.45 * PI;
const PETAL_WIDTH_FORESHORTEN_MIN = 0.42;
// 浓淡墨 monochrome rendering — pure neutral grey, no hue tint.
const INK_HUE = 0;
const INK_SAT = 0;
const PETAL_HUE = INK_HUE;
const PETAL_BASE_SAT = INK_SAT;
const PETAL_BASE_VAL = 0.1; // 浓墨
const PETAL_TIP_SAT = INK_SAT;
const PETAL_TIP_VAL = 0.78; // 淡墨
const PETAL_BLUR_PX = 0;

const CALYX_HUE = INK_HUE;
const CALYX_SAT = INK_SAT;
const CALYX_VAL = 0.18;
const CALYX_HEIGHT = 42;
const CALYX_TOP_WIDTH = 22;
const CALYX_BOTTOM_WIDTH = 3;


// ── inkBlob — single brush-stamp leaf ────────────────────

interface InkBlobArgs {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation: number;
  inkValDark: number;
  inkValLight: number;
  alpha: number;
  asymmetry: number; // 0 = pure radial gradient, 1 = pure linear gradient
  withStreak: boolean;
}

function inkBlob(ctx: CanvasRenderingContext2D, args: InkBlobArgs): void {
  const samples = 96;
  const phi = BBS.next() * 2 * PI;
  const noiseFreq = 2 + BBS.next() * 1.5;

  // Lotus pad shape: round (rx≈ry) with a triangular notch at one
  // perimeter point — the cleft running from the edge toward the centre
  // where the petiole joins. Notch is a Gaussian dip in the radius
  // function at local angle 0; `rotation` controls where the notch ends
  // up on screen.
  const notchDepth = 0.18 + BBS.next() * 0.16;
  const notchSigma = 0.20 + BBS.next() * 0.10;

  const path: Array<[number, number]> = [];
  const cosR = cos(args.rotation);
  const sinR = sin(args.rotation);
  // Track the local-frame radius at each sample for vein drawing.
  const localRadii: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * 2 * PI;
    // Distance from notch (local angle 0), wrapped to [-π, π].
    let dt = t;
    while (dt > PI) dt -= 2 * PI;
    while (dt < -PI) dt += 2 * PI;
    const notchFactor = 1 - notchDepth * Math.exp(-(dt * dt) / (notchSigma * notchSigma));

    const noise = pnoise(cos(t) * noiseFreq + phi, sin(t) * noiseFreq + phi);
    const perturb = 1 + (noise - 0.5) * LEAF_NOISE * 2;
    const radiusFactor = notchFactor * perturb;
    localRadii.push(radiusFactor);
    const lx = args.rx * cos(t) * radiusFactor;
    const ly = args.ry * sin(t) * radiusFactor;
    const x = args.cx + lx * cosR - ly * sinR;
    const y = args.cy + lx * sinR + ly * cosR;
    path.push([x, y]);
  }

  ctx.save();
  ctx.filter = `blur(${LEAF_BLUR_PX}px)`;
  // Strong ink-bleed halo. Dense ink colour + wide blur + high alpha so the
  // wet edges read clearly and overlapping leaves' halos blend into each
  // other like soaked-through xuan paper.
  ctx.shadowColor = hsv(LEAF_HUE, 0.2, args.inkValDark * 0.8, 0.85);
  ctx.shadowBlur = 32;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Pick a gradient: most leaves use linear (a wet-side / dry-side feel that
  // matches single-stroke ink); some use radial (when the leaf is more
  // top-down, looks like a wash with a darker centre).
  let grad: CanvasGradient;
  if (args.asymmetry > 0.35) {
    // Linear: pick a direction in the leaf's local frame — most often roughly
    // perpendicular to the long axis, so dark and light halves split along
    // the brushstroke direction.
    const gradAngle = args.rotation + PI / 2 + (BBS.next() - 0.5) * 0.6;
    const gradHalf = Math.max(args.rx, args.ry);
    const gx0 = args.cx - cos(gradAngle) * gradHalf;
    const gy0 = args.cy - sin(gradAngle) * gradHalf;
    const gx1 = args.cx + cos(gradAngle) * gradHalf;
    const gy1 = args.cy + sin(gradAngle) * gradHalf;
    grad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    grad.addColorStop(0, hsv(LEAF_HUE, 0.18, args.inkValDark, args.alpha));
    grad.addColorStop(0.5, hsv(LEAF_HUE, 0.12, args.inkValDark * 1.6, args.alpha * 0.85));
    grad.addColorStop(1, hsv(LEAF_HUE, 0.06, args.inkValLight, args.alpha * 0.45));
  } else {
    grad = ctx.createRadialGradient(
      args.cx,
      args.cy,
      0,
      args.cx,
      args.cy,
      Math.max(args.rx, args.ry) * 1.05,
    );
    grad.addColorStop(0, hsv(LEAF_HUE, 0.16, args.inkValDark * 1.1, args.alpha));
    grad.addColorStop(0.6, hsv(LEAF_HUE, 0.1, args.inkValDark * 1.6, args.alpha * 0.8));
    grad.addColorStop(1, hsv(LEAF_HUE, 0.05, args.inkValLight, args.alpha * 0.25));
  }

  ctx.beginPath();
  ctx.moveTo(path[0][0], path[0][1]);
  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Radial veins from the centre outward — skip rays in the direction of
  // the notch since real lotus pad veins emerge from the petiole point.
  // Veins are stroked with mild blur so they don't read as drawn lines but
  // as visible folds in the wash.
  ctx.save();
  ctx.filter = "blur(0.4px)";
  const veinCount = 6 + Math.floor(BBS.next() * 4); // 6..9
  ctx.lineCap = "round";
  for (let v = 0; v < veinCount; v++) {
    // Spread vein angles around the leaf, leaving a wedge near angle 0
    // (the notch direction) clear.
    const wedgeStart = 0.4 * PI; // skip ±0.4π around notch
    const wedgeRange = 2 * PI - 2 * wedgeStart;
    const tAngle = wedgeStart + (v / Math.max(1, veinCount - 1)) * wedgeRange + (BBS.next() - 0.5) * 0.18;
    const cosT = cos(tAngle);
    const sinT = sin(tAngle);
    // Sample the perimeter near this angle to find the vein tip radius.
    const sampleIdx = Math.floor((tAngle / (2 * PI)) * samples) % samples;
    const tipR = localRadii[(sampleIdx + samples) % samples] * 0.86;
    // Endpoints in local frame.
    const tipLX = args.rx * cosT * tipR;
    const tipLY = args.ry * sinT * tipR;
    const tipX = args.cx + tipLX * cosR - tipLY * sinR;
    const tipY = args.cy + tipLX * sinR + tipLY * cosR;
    // Wobble along the vein for hand-drawn feel
    const segs = 8;
    ctx.beginPath();
    for (let s = 0; s <= segs; s++) {
      const u = s / segs;
      const px = args.cx + (tipX - args.cx) * u + (BBS.next() - 0.5) * Math.min(args.rx, args.ry) * 0.02;
      const py = args.cy + (tipY - args.cy) * u + (BBS.next() - 0.5) * Math.min(args.rx, args.ry) * 0.02;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.lineWidth = 0.6 + BBS.next() * 0.5;
    ctx.strokeStyle = hsv(
      LEAF_HUE,
      0.12,
      args.inkValDark * 0.55,
      args.alpha * (0.45 + BBS.next() * 0.3),
    );
    ctx.stroke();
  }
  ctx.restore();

  // Optional brush streak — short curved stroke suggesting a fold/crease.
  // Now drawn from the notch direction toward the leaf centre, mimicking
  // the visible cleft fold on real pads.
  if (args.withStreak) {
    drawBrushStreak(ctx, args);
  }
}

function drawBrushStreak(ctx: CanvasRenderingContext2D, args: InkBlobArgs): void {
  // Streak runs roughly along the long axis of the leaf, slightly curved.
  const len = Math.max(args.rx, args.ry) * normRand(0.55, 0.95);
  const ax = cos(args.rotation);
  const ay = sin(args.rotation);
  const offset = (BBS.next() - 0.5) * Math.min(args.rx, args.ry) * 0.25;
  const px = -ay;
  const py = ax;
  const baseX = args.cx + px * offset;
  const baseY = args.cy + py * offset;
  const x0 = baseX - ax * len * 0.5;
  const y0 = baseY - ay * len * 0.5;
  const x1 = baseX + ax * len * 0.5;
  const y1 = baseY + ay * len * 0.5;
  // Slight perpendicular bend at midpoint.
  const bend = (BBS.next() - 0.5) * Math.min(args.rx, args.ry) * 0.15;
  const cx = baseX + px * bend;
  const cy = baseY + py * bend;

  ctx.save();
  ctx.lineCap = "round";
  ctx.filter = `blur(${LEAF_BLUR_PX * 0.4}px)`;
  ctx.strokeStyle = hsv(LEAF_HUE, 0.2, args.inkValDark * 0.55, args.alpha * 0.7);
  ctx.lineWidth = 1.2 + BBS.next() * 1.2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  ctx.restore();
}

// ── drawPetal — single lotus petal with linear gradient ──

interface PetalColor {
  hue: number;
  baseSat: number;
  baseVal: number;
  tipSat: number;
  tipVal: number;
}

function drawPetal(
  ctx: CanvasRenderingContext2D,
  args: {
    baseX: number;
    baseY: number;
    tipX: number;
    tipY: number;
    maxWidth: number;
    /** 0..1 — fraction of maxWidth this petal shows (foreshortening). */
    widthScale: number;
    color: PetalColor;
    alpha: number;
    /** -1..+1; asymmetric edge bulge sign and magnitude. */
    curl: number;
    /** Seed for per-petal edge noise. */
    edgeSeed: number;
    /** Width-profile exponent. ~0.4 = sharp tip, ~0.75 = round-ish tip. */
    shapePower: number;
    /** Where along spine the widest point sits (0..1). 0.5 = symmetric. */
    widePos: number;
    /** Asymmetric tip lean: tip displaced perpendicular to spine, in px. */
    tipLean: number;
  },
): void {
  const {
    baseX, baseY, tipX, tipY, maxWidth, widthScale, color, alpha,
    curl, edgeSeed, shapePower, widePos, tipLean,
  } = args;

  const dx = tipX - baseX;
  const dy = tipY - baseY;
  const len = Math.hypot(dx, dy);
  if (len < 4) return;
  const ax = dx / len;
  const ay = dy / len;
  // Perpendicular (rotated 90° clockwise in screen space).
  const px = -ay;
  const py = ax;
  const effectiveWidth = maxWidth * widthScale;

  const segments = 26;
  const rightFactor = 1 + curl * 0.4;
  const leftFactor = 1 - curl * 0.4;

  // Width profile peaks at `widePos` (independent rise and fall)—so the
  // petal can be lance-shaped (widest near base) or oval (widest at midpoint)
  // depending on the spec, instead of a single shared formula.
  const widthAt = (t: number): number => {
    const rise =
      widePos > 1e-3 ? Math.pow(sin(Math.min(1, t / widePos) * PI * 0.5), shapePower) : 1;
    const fall =
      1 - widePos > 1e-3
        ? Math.pow(sin(Math.min(1, (1 - t) / (1 - widePos)) * PI * 0.5), shapePower)
        : 1;
    return effectiveWidth * Math.min(rise, fall);
  };

  ctx.save();
  ctx.filter = PETAL_BLUR_PX > 0 ? `blur(${PETAL_BLUR_PX}px)` : "none";
  // Moderate outward bleed — keep petal silhouette legible enough to read
  // as a single brush stroke, rather than melting into a fog.
  ctx.shadowColor = hsv(color.hue, color.baseSat, color.baseVal, 0.55);
  ctx.shadowBlur = 11;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Smooth bezier silhouette. Each petal edge is a single cubic curve
  // from base to tip, controlled by two anchor points that define the
  // bulge profile. Real lotus petals have continuous curvature — a
  // polyline of point samples (even without noise) can read as faceted
  // at small scales; bezier never does.
  void edgeSeed; // unused now
  const peakW = effectiveWidth;
  // Tip lands on the spine axis, slightly offset by tipLean.
  const tipPathX = baseX + ax * len + px * tipLean * 0.5;
  const tipPathY = baseY + ay * len + py * tipLean * 0.5;
  // Where along the axis the petal bulges fattest. widePos is in [0..1].
  const ax25 = baseX + ax * len * Math.max(0.1, widePos);
  const ay25 = baseY + ay * len * Math.max(0.1, widePos);
  // Second anchor sits near the tip end with small perpendicular offset
  // so the curve approaches the tip softly — sharp pointed tips look
  // synthetic on a lotus.
  // v7: "宽肩水滴 + 单边内卷曲线" geometry from the 11-day-ago refactor.
  // - r2 (second control point) is pushed further off-spine (wTail=0.4)
  //   instead of 0.22. This keeps the upper third of the petal BULGY
  //   rather than tapering into a knife-shaped tip.
  // - widePos is biased toward the base (passed in lower range).
  // - After fill, a single inward-curl line is stroked to suggest the
  //   concave inside of the petal — the visible "fold" line you see on
  //   a real lotus petal where it cups slightly.
  const ax75 = baseX + ax * len * 0.85;
  const ay75 = baseY + ay * len * 0.85;
  const wMid = peakW;
  const wTail = peakW * 0.4;
  const r1x = ax25 + px * wMid * rightFactor;
  const r1y = ay25 + py * wMid * rightFactor;
  const r2x = ax75 + px * wTail * rightFactor;
  const r2y = ay75 + py * wTail * rightFactor;
  const l1x = ax25 - px * wMid * leftFactor;
  const l1y = ay25 - py * wMid * leftFactor;
  const l2x = ax75 - px * wTail * leftFactor;
  const l2y = ay75 - py * wTail * leftFactor;

  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.bezierCurveTo(r1x, r1y, r2x, r2y, tipPathX, tipPathY);
  ctx.bezierCurveTo(l2x, l2y, l1x, l1y, baseX, baseY);
  ctx.closePath();

  const grad = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
  grad.addColorStop(0, hsv(color.hue, color.baseSat, color.baseVal, alpha));
  grad.addColorStop(0.5, hsv(color.hue, (color.baseSat + color.tipSat) * 0.5, (color.baseVal + color.tipVal) * 0.5, alpha));
  grad.addColorStop(1, hsv(color.hue, color.tipSat, color.tipVal, alpha * 0.95));
  ctx.fillStyle = grad;
  ctx.fill();

  // Inner curl — a single quadratic curve from base into the petal
  // body, drawn on whichever side `curl` favours. Suggests the petal's
  // concave inside surface; a real ink-painted lotus uses one such
  // fold line per petal rather than detailed shading.
  ctx.shadowBlur = 0;
  const curlSide = curl >= 0 ? 1 : -1;
  const curlMidX = baseX + ax * len * 0.35 + px * wMid * 0.45 * curlSide;
  const curlMidY = baseY + ay * len * 0.35 + py * wMid * 0.45 * curlSide;
  const curlEndX = baseX + ax * len * 0.7 + px * wTail * 0.25 * curlSide;
  const curlEndY = baseY + ay * len * 0.7 + py * wTail * 0.25 * curlSide;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(curlMidX, curlMidY, curlEndX, curlEndY);
  ctx.strokeStyle = hsv(color.hue, color.baseSat, color.baseVal * 0.55, alpha * 0.6);
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.restore();
}

// ── drawFlower — full flower stack (calyx + dark core + petal fan) ──
//
// Encapsulates one bloom so drawLotus can render multiple flowers in a
// single composition. flowerX/flowerY is the petal-base attachment point;
// calyx grows downward from there, petals fan upward.
function drawFlower(ctx: CanvasRenderingContext2D, flowerX: number, flowerY: number): void {
  drawCalyx(ctx, flowerX, flowerY);

  // Petals: 3D yaw/pitch arrangement, projected to 2D and depth-sorted.
  const petalCount = Math.floor(normRand(PETAL_COUNT_MIN, PETAL_COUNT_MAX + 1));
  type PetalSpec = {
    yaw: number;
    pitch: number;
    length: number;
    width: number;
    curl: number;
    edgeSeed: number;
    hueShift: number;
    satShift: number;
    valShift: number;
    baseJitterX: number;
    baseJitterY: number;
  };
  type PetalSpecExt = PetalSpec & {
    shapePower: number;
    widePos: number;
    tipLean: number;
  };
  const petals: PetalSpecExt[] = [];
  const yawOffset = BBS.next() * 2 * PI;
  for (let i = 0; i < petalCount; i++) {
    // Yaw: even base + much larger jitter so adjacent petals sometimes
    // crowd and sometimes leave gaps — not a perfect daisy.
    const yawBase = (i / petalCount) * 2 * PI + yawOffset;
    const yaw = yawBase + (BBS.next() - 0.5) * (PI / petalCount) * 1.6;
    const pitchBias = (1 - Math.cos(yaw)) * 0.5;
    const pitch =
      mapval(BBS.next(), 0, 1, PETAL_PITCH_MIN, PETAL_PITCH_MAX) * (0.6 + 0.6 * pitchBias);
    petals.push({
      yaw,
      pitch,
      // Wider per-petal length/width range — some clearly larger.
      length: PETAL_LENGTH * normRand(0.7, 1.25),
      width: PETAL_WIDTH * normRand(0.75, 1.3),
      curl: (BBS.next() - 0.5) * 0.85,
      edgeSeed: BBS.next() * 31,
      hueShift: 0, // ink rendering — no hue variation
      satShift: (BBS.next() - 0.5) * 0.08,
      valShift: (BBS.next() - 0.5) * 0.22, // bigger value jitter for visible per-petal ink density
      baseJitterX: (BBS.next() - 0.5) * 12,
      baseJitterY: (BBS.next() - 0.5) * 6,
      // widePos is now where the bezier anchor sits along the spine —
      // higher = bulge toward middle (classic lotus petal teardrop).
      shapePower: 1, // unused by bezier silhouette
      widePos: normRand(0.22, 0.32),
      tipLean: (BBS.next() - 0.5) * 0.25 * PETAL_WIDTH,
    });
  }
  petals.sort((a, b) => Math.cos(a.yaw) - Math.cos(b.yaw));

  for (const p of petals) {
    const horizontalReach = sin(p.pitch) * p.length;
    const verticalReach = cos(p.pitch) * p.length;
    const tipX = flowerX + sin(p.yaw) * horizontalReach;
    const verticalLiftFactor = 0.85 + 0.15 * Math.max(0, Math.cos(p.yaw));
    const tipY = flowerY - verticalReach * verticalLiftFactor;
    const widthScale = Math.max(PETAL_WIDTH_FORESHORTEN_MIN, Math.abs(Math.cos(p.yaw)));
    drawPetal(ctx, {
      baseX: flowerX + p.baseJitterX,
      baseY: flowerY + p.baseJitterY,
      tipX,
      tipY,
      maxWidth: p.width,
      widthScale,
      color: {
        hue: PETAL_HUE,
        baseSat: Math.max(0, Math.min(0.4, PETAL_BASE_SAT + p.satShift)),
        baseVal: Math.max(0.05, Math.min(0.4, PETAL_BASE_VAL + p.valShift * 0.4)),
        tipSat: Math.max(0, Math.min(0.4, PETAL_TIP_SAT + p.satShift)),
        tipVal: Math.max(0.45, Math.min(0.95, PETAL_TIP_VAL + p.valShift * 0.6)),
      },
      alpha: 1,
      curl: p.curl,
      edgeSeed: p.edgeSeed,
      shapePower: p.shapePower,
      widePos: p.widePos,
      tipLean: p.tipLean,
    });
  }
}

// ── drawCalyx — short tan cone below petals, base of the flower ──
function drawCalyx(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.filter = "blur(0.6px)";
  const grad = ctx.createLinearGradient(x, y, x, y + CALYX_HEIGHT);
  grad.addColorStop(0, hsv(CALYX_HUE, CALYX_SAT * 0.85, CALYX_VAL * 1.1, 0.95));
  grad.addColorStop(1, hsv(CALYX_HUE, CALYX_SAT, CALYX_VAL * 0.7, 0.92));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - CALYX_TOP_WIDTH / 2, y);
  ctx.quadraticCurveTo(x - CALYX_TOP_WIDTH / 3, y + CALYX_HEIGHT * 0.6, x - CALYX_BOTTOM_WIDTH / 2, y + CALYX_HEIGHT);
  ctx.lineTo(x + CALYX_BOTTOM_WIDTH / 2, y + CALYX_HEIGHT);
  ctx.quadraticCurveTo(x + CALYX_TOP_WIDTH / 3, y + CALYX_HEIGHT * 0.6, x + CALYX_TOP_WIDTH / 2, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── drawStem — thin curved ink line ──────────────────────

// Draw a stem in two layers:
//   1. Body — continuous tubify polygon at full width, medium alpha. Gives
//      the stem its visual mass so it doesn't read as wire.
//   2. Wet-band overlay — narrower dabs stamped on top of selected segments
//      where the band-noise says "ink loaded here". Adds along-length tonal
//      variation so the body doesn't read as a uniform rod.
// Spine is perlin-wobbled so the silhouette isn't a clean bezier.

interface SpineSample {
  x: number;
  y: number;
  nx: number;
  ny: number;
  tangentAngle: number;
  baseW: number;
}

function drawStem(ctx: CanvasRenderingContext2D, anchorX: number, anchorY: number): void {
  const bottomY = CWID + STEM_BOTTOM_OVERSHOOT;
  // Bigger horizontal drift so the stem can clearly lean — natural stems
  // don't all run perfectly plumb.
  const horizDrift = (BBS.next() - 0.5) * STEM_BEND_RANGE_PX * 1.2;
  const bottomX = anchorX + horizDrift;
  // Two independent control points → cubic bezier. When bend1 and bend2
  // share a sign the stem makes one big arc; when they differ, an S-curve.
  // Both look softer than a single-arc quadratic.
  const bend1 = (BBS.next() - 0.5) * STEM_BEND_RANGE_PX * 1.2;
  const bend2 = (BBS.next() - 0.5) * STEM_BEND_RANGE_PX * 1.2;
  const ctrl1X = anchorX + (bottomX - anchorX) * 0.33 + bend1;
  const ctrl1Y = anchorY + (bottomY - anchorY) * 0.33;
  const ctrl2X = anchorX + (bottomX - anchorX) * 0.67 + bend2;
  const ctrl2Y = anchorY + (bottomY - anchorY) * 0.67;
  const noiseSeed = BBS.next() * 13;
  const wobbleSeed = BBS.next() * 17;
  const bandSeed = BBS.next() * 23;
  // Cubic bezier evaluation — used in every sampling loop in this function.
  const bezierAt = (t: number): { x: number; y: number; tx: number; ty: number } => {
    const u = 1 - t;
    return {
      x: u * u * u * anchorX + 3 * u * u * t * ctrl1X + 3 * u * t * t * ctrl2X + t * t * t * bottomX,
      y: u * u * u * anchorY + 3 * u * u * t * ctrl1Y + 3 * u * t * t * ctrl2Y + t * t * t * bottomY,
      tx: 3 * u * u * (ctrl1X - anchorX) + 6 * u * t * (ctrl2X - ctrl1X) + 3 * t * t * (bottomX - ctrl2X),
      ty: 3 * u * u * (ctrl1Y - anchorY) + 6 * u * t * (ctrl2Y - ctrl1Y) + 3 * t * t * (bottomY - ctrl2Y),
    };
  };

  const samples = 56;
  const spine: SpineSample[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const b = bezierAt(t);
    let x = b.x;
    let y = b.y;
    const tx = b.tx;
    const ty = b.ty;
    const tlen = Math.hypot(tx, ty) || 1;
    const nx = -ty / tlen;
    const ny = tx / tlen;

    const wobbleEnvelope = sin(t * PI);
    const wobble =
      (pnoise(t * STEM_WOBBLE_FREQ + wobbleSeed, 0) - 0.5) *
      STEM_WOBBLE_AMPLITUDE_PX * 2 *
      wobbleEnvelope;
    x += nx * wobble;
    y += ny * wobble;

    const lowNoise = pnoise(t * STEM_NOISE_FREQ + noiseSeed, 0);
    const hiNoise = pnoise(t * STEM_NOISE_FREQ_HI + noiseSeed * 0.3, PI);
    const widthFraction =
      STEM_MIN_WIDTH_FRAC +
      (1 - STEM_MIN_WIDTH_FRAC) * (0.55 * lowNoise + 0.45 * hiNoise);
    const taper = t < 0.05 ? mapval(t, 0, 0.05, 0.55, 1) : 1;
    const baseW = STEM_BASE_WIDTH * widthFraction * taper;
    spine.push({ x, y, nx, ny, tangentAngle: Math.atan2(ty, tx), baseW });
  }

  // ── Body: continuous tubified polygon ──
  const buildPath = (widthScale: number): Array<[number, number]> => {
    const path: Array<[number, number]> = [];
    for (const s of spine) {
      const w = s.baseW * widthScale * 0.5;
      path.push([s.x + s.nx * w, s.y + s.ny * w]);
    }
    for (let i = spine.length - 1; i >= 0; i--) {
      const s = spine[i];
      const w = s.baseW * widthScale * 0.5;
      path.push([s.x - s.nx * w, s.y - s.ny * w]);
    }
    return path;
  };

  // ── Body polygon — gives the stem its solid mass ──
  ctx.save();
  ctx.filter = "blur(0.5px)";
  const bodyPath = buildPath(1.0);
  const bodyAlphaSeed = BBS.next() * 11;
  const bodyValSeed = BBS.next() * 17;
  const bodyGrad = ctx.createLinearGradient(anchorX, anchorY, bottomX, bottomY);
  const stops = 9;
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const aN = pnoise(t * 3.4 + bodyAlphaSeed, 0);
    const vN = pnoise(t * 2.6 + bodyValSeed, PI);
    const alpha = mapval(aN, 0, 1, 0.42, 0.95);
    const valScale = mapval(vN, 0, 1, 0.7, 1.25);
    bodyGrad.addColorStop(t, hsv(STEM_HUE, STEM_SAT, STEM_VAL * valScale, alpha));
  }
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(bodyPath[0][0], bodyPath[0][1]);
  for (let i = 1; i < bodyPath.length; i++) ctx.lineTo(bodyPath[i][0], bodyPath[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ── Hair-bundle 飞白 overlay ──
  // Drawn AFTER the body, in destination-out mode, so each hair-line acts
  // as a "bristle gap" — when it's at high alpha (the hair "ran dry"
  // here) it carves a thin white slit through the body. Multiple hairs at
  // various lateral positions, each with independent perlin presence,
  // produce the parallel-stripe pattern that defines feibai.
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.filter = `blur(${HAIR_BLUR_PX}px)`;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = HAIR_LINE_WIDTH;
  const totalLen = Math.hypot(bottomX - anchorX, bottomY - anchorY);
  const samplesPerHair = Math.max(60, Math.floor(totalLen / 4));

  for (let h = 0; h < HAIR_COUNT; h++) {
    const hairFrac = ((h + 0.5) / HAIR_COUNT) * 2 - 1 + (BBS.next() - 0.5) * 0.08;
    const hairSeed = BBS.next() * 53 + h * 11;
    // Per-hair dryness skewed HIGH — most hairs show some flying-white
    // carving along the stem so the effect is visible across the whole
    // bundle, not just on a couple of unlucky hairs.
    const hairDryness = mapval(BBS.next(), 0, 1, HAIR_DRYNESS_MIN, HAIR_DRYNESS_MAX);

    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i <= samplesPerHair; i++) {
      const t = i / samplesPerHair;
      const alphaLow = pnoise(t * HAIR_ALPHA_FREQ_LOW + hairSeed, 0);
      const alphaHigh = pnoise(t * HAIR_ALPHA_FREQ_HIGH + hairSeed * 0.3, PI);
      const drynessHere = (0.6 * alphaLow + 0.4 * alphaHigh) * hairDryness;
      if (drynessHere < HAIR_PRESENCE_THRESHOLD) {
        if (drawing) {
          ctx.stroke();
          ctx.beginPath();
          drawing = false;
        }
        continue;
      }
      const erase =
        mapval(drynessHere, HAIR_PRESENCE_THRESHOLD, 1, 0.5, HAIR_ALPHA_MAX) *
        Math.pow(sin(t * PI), 0.35);
      if (erase < 0.05) {
        if (drawing) {
          ctx.stroke();
          ctx.beginPath();
          drawing = false;
        }
        continue;
      }

      const b = bezierAt(t);
      let x = b.x;
      let y = b.y;
      const tx = b.tx;
      const ty = b.ty;
      const tlen = Math.hypot(tx, ty) || 1;
      const nx = -ty / tlen;
      const ny = tx / tlen;

      const wobble =
        (pnoise(t * STEM_WOBBLE_FREQ + wobbleSeed, 0) - 0.5) *
        STEM_WOBBLE_AMPLITUDE_PX * 2 *
        sin(t * PI);
      x += nx * wobble;
      y += ny * wobble;

      const lowNoise = pnoise(t * STEM_NOISE_FREQ + noiseSeed, 0);
      const hiNoise = pnoise(t * STEM_NOISE_FREQ_HI + noiseSeed * 0.3, PI);
      const widthFraction =
        STEM_MIN_WIDTH_FRAC +
        (1 - STEM_MIN_WIDTH_FRAC) * (0.55 * lowNoise + 0.45 * hiNoise);
      const taper = t < 0.05 ? mapval(t, 0, 0.05, 0.55, 1) : 1;
      const halfW = STEM_BASE_WIDTH * widthFraction * taper * 0.5;
      x += nx * halfW * hairFrac;
      y += ny * halfW * hairFrac;

      ctx.strokeStyle = `rgba(0,0,0,${erase})`;
      if (!drawing) {
        ctx.moveTo(x, y);
        drawing = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (drawing) ctx.stroke();
  }
  ctx.restore();

  // ── Prickles (小毛刺) ──
  // Sample along the bezier; at points where the perlin density signal
  // exceeds threshold, stamp a tiny whisker — a short line segment going
  // outward from the stem perpendicular to the local tangent. Side
  // (left/right) and length are noise-driven so prickles cluster naturally.
  ctx.save();
  ctx.lineCap = "round";
  const prickleSeed = BBS.next() * 29;
  const prickleSideSeed = BBS.next() * 37;
  const prickleCount = Math.floor(
    normRand(PRICKLE_COUNT_PER_STEM_MIN, PRICKLE_COUNT_PER_STEM_MAX + 1),
  );
  for (let i = 0; i < prickleCount * 2; i++) {
    // Sample twice as many candidate positions so threshold filtering keeps
    // ~prickleCount of them.
    const t = 0.06 + 0.92 * (i / (prickleCount * 2 - 1)) + (BBS.next() - 0.5) * 0.04;
    if (t < 0.05 || t > 0.98) continue;
    const density = pnoise(t * PRICKLE_DENSITY_FREQ + prickleSeed, 0);
    if (density < PRICKLE_DENSITY_THRESHOLD) continue;

    const b = bezierAt(t);
    let x = b.x;
    let y = b.y;
    const tx = b.tx;
    const ty = b.ty;
    const tlen = Math.hypot(tx, ty) || 1;
    const nx = -ty / tlen;
    const ny = tx / tlen;
    // Match body wobble.
    const wobble =
      (pnoise(t * STEM_WOBBLE_FREQ + wobbleSeed, 0) - 0.5) *
      STEM_WOBBLE_AMPLITUDE_PX * 2 *
      sin(t * PI);
    x += nx * wobble;
    y += ny * wobble;

    // Local stem half-width — anchor prickle at the edge of the stem.
    const lowNoise = pnoise(t * STEM_NOISE_FREQ + noiseSeed, 0);
    const hiNoise = pnoise(t * STEM_NOISE_FREQ_HI + noiseSeed * 0.3, PI);
    const widthFraction =
      STEM_MIN_WIDTH_FRAC +
      (1 - STEM_MIN_WIDTH_FRAC) * (0.55 * lowNoise + 0.45 * hiNoise);
    const taper = t < 0.05 ? mapval(t, 0, 0.05, 0.55, 1) : 1;
    const halfW = STEM_BASE_WIDTH * widthFraction * taper * 0.5;
    // Side (left/right of stem) — perlin so adjacent prickles tend to cluster
    // on the same side.
    const sideNoise = pnoise(t * 1.5 + prickleSideSeed, 0);
    const sideSign = sideNoise > 0.5 ? 1 : -1;
    // Edge anchor on the chosen side (slightly inside so the prickle base
    // sits on the silhouette).
    const edgeX = x + nx * halfW * sideSign * 0.92;
    const edgeY = y + ny * halfW * sideSign * 0.92;
    // Prickle length and tilt (mostly perpendicular but with random skew).
    const prLen = normRand(PRICKLE_LEN_MIN, PRICKLE_LEN_MAX);
    const skew = (BBS.next() - 0.5) * 0.6;
    const dirX = nx * sideSign * Math.cos(skew) + (tx / tlen) * Math.sin(skew);
    const dirY = ny * sideSign * Math.cos(skew) + (ty / tlen) * Math.sin(skew);
    const tipX = edgeX + dirX * prLen;
    const tipY = edgeY + dirY * prLen;

    const alpha = mapval(density, PRICKLE_DENSITY_THRESHOLD, 1, PRICKLE_ALPHA_MIN, PRICKLE_ALPHA_MAX);
    ctx.lineWidth = 0.5 + BBS.next() * 0.5;
    ctx.strokeStyle = hsv(0, 0, PRICKLE_VAL, alpha);
    ctx.beginPath();
    ctx.moveTo(edgeX, edgeY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
  }
  ctx.restore();
}

// ── drawLotus — composition entry point ──────────────────

export function drawLotus(
  ctx: CanvasRenderingContext2D,
  opts: SpeciesDrawOpts,
): void {
  const { xof, yof, fast } = opts;
  const cwid = CWID;
  const inkLayer = Layer.empty(cwid);
  const colorLayer = Layer.empty(cwid);

  // ── Leaf cluster ──
  type LeafSpec = {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    rotation: number;
    depth: number;
    asymmetry: number;
    withStreak: boolean;
  };
  const leafCount = Math.floor(normRand(LEAF_COUNT_MIN, LEAF_COUNT_MAX + 1));
  const leaves: LeafSpec[] = [];
  for (let i = 0; i < leafCount; i++) {
    const cx =
      cwid * (CLUSTER_X_MIN_FRAC + (CLUSTER_X_MAX_FRAC - CLUSTER_X_MIN_FRAC) * BBS.next());
    const cy = mapval(BBS.next(), 0, 1, CLUSTER_Y_MIN, CLUSTER_Y_MAX);
    const rx = normRand(LEAF_RADIUS_MIN, LEAF_RADIUS_MAX);
    const ry = rx * normRand(LEAF_AXIS_RATIO_MIN, LEAF_AXIS_RATIO_MAX);
    const rotation = BBS.next() * PI;
    const depth = BBS.next();
    const asymmetry = BBS.next();
    const withStreak = BBS.next() < LEAF_STREAK_CHANCE;
    leaves.push({ cx, cy, rx, ry, rotation, depth, asymmetry, withStreak });
  }
  // Render back-to-front so dark foreground leaves dominate where overlap
  // exists. Multiply blit then accumulates density at intersections.
  leaves.sort((a, b) => a.depth - b.depth);

  // ── Stems first (under leaves and flowers) ──
  // Each leaf gets its own stem from leaf-centre down to canvas bottom; the
  // stem segments inside leaves get multiplied over by the leaf paint. Only
  // the segments that emerge below other leaves end up visibly drawn.
  inkLayer.ctx.save();
  inkLayer.ctx.globalCompositeOperation = "multiply";
  for (const lf of leaves) {
    drawStem(inkLayer.ctx, lf.cx, lf.cy);
  }
  inkLayer.ctx.restore();

  // Multiply within the ink layer compounds darkness wherever leaves stack.
  inkLayer.ctx.save();
  inkLayer.ctx.globalCompositeOperation = "multiply";
  for (const lf of leaves) {
    const inkValDark = mapval(lf.depth, 0, 1, LEAF_VAL_DARK_MAX, LEAF_VAL_DARK_MIN);
    const inkValLight = mapval(lf.depth, 0, 1, LEAF_VAL_LIGHT_MAX, LEAF_VAL_LIGHT_MIN);
    const alpha = mapval(lf.depth, 0, 1, LEAF_ALPHA_FAR, LEAF_ALPHA_NEAR);
    inkBlob(inkLayer.ctx, {
      cx: lf.cx,
      cy: lf.cy,
      rx: lf.rx,
      ry: lf.ry,
      rotation: lf.rotation,
      inkValDark,
      inkValLight,
      alpha,
      asymmetry: lf.asymmetry,
      withStreak: lf.withStreak,
    });
  }
  inkLayer.ctx.restore();

  // ── Flower positions + their stems ──
  // Each flower's stem runs from the flower base all the way down to the
  // canvas bottom; the leaf cluster multiplies over the middle portion, so
  // visible portions are above the cluster (clearly) and below the cluster
  // (where the stem exits the painting).
  const flowerCount = Math.floor(normRand(FLOWER_COUNT_MIN, FLOWER_COUNT_MAX + 1));
  const minSpread = cwid * FLOWER_X_SPREAD_MIN_FRAC;
  const flowerXs: number[] = [];
  let attempts = 0;
  while (flowerXs.length < flowerCount && attempts < 30) {
    const candidate =
      cwid * (X_FLOWER_MIN_FRAC + (X_FLOWER_MAX_FRAC - X_FLOWER_MIN_FRAC) * BBS.next());
    if (flowerXs.every((x) => Math.abs(x - candidate) >= minSpread)) {
      flowerXs.push(candidate);
    }
    attempts++;
  }
  const flowerSpecs = flowerXs.map((flowerX) => {
    const flowerY = mapval(BBS.next(), 0, 1, Y_FLOWER_MIN, Y_FLOWER_MAX);
    return { flowerX, flowerY };
  });
  inkLayer.ctx.save();
  inkLayer.ctx.globalCompositeOperation = "multiply";
  for (const fs of flowerSpecs) {
    drawStem(inkLayer.ctx, fs.flowerX, fs.flowerY);
  }
  inkLayer.ctx.restore();

  // ── Render each flower: calyx + dark core + petal fan ──
  for (const fs of flowerSpecs) {
    drawFlower(colorLayer.ctx, fs.flowerX, fs.flowerY);
  }

  // ── Output ──
  // No Layer.filter passes — wet-edge feel comes from the per-shape blur
  // already applied during ink/petal draws.
  let xref: number;
  let yref: number;
  if (fast) {
    xref = xof - cwid / 2;
    yref = yof - Math.round(cwid * 0.9);
    ctx.save();
    Layer.blit(ctx, inkLayer.ctx, { ble: "multiply", xof: xref, yof: yref });
    Layer.blit(ctx, colorLayer.ctx, { ble: "normal", xof: xref, yof: yref });
    ctx.restore();
    return;
  }

  const b1 = Layer.bound(inkLayer.ctx);
  const b2 = Layer.bound(colorLayer.ctx);
  const bd = {
    xmin: Math.min(b1.xmin, b2.xmin),
    xmax: Math.max(b1.xmax, b2.xmax),
    ymin: Math.min(b1.ymin, b2.ymin),
    ymax: Math.max(b1.ymax, b2.ymax),
  };
  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;
  const contentW = Math.max(1, bd.xmax - bd.xmin);
  const contentH = Math.max(1, bd.ymax - bd.ymin);
  // Reserve margins so the elevated flower at top and any leaf extent at
  // bottom don't clip. herbal()'s formula scales content to fill, which
  // works for plants rooted at the bottom but crops a lotus whose flower
  // sits at the very top of the layer.
  const horizMargin = targetW * 0.05;
  const topMargin = targetH * 0.04;
  const bottomMargin = targetH * 0.04;
  const scale = Math.min(
    1,
    (targetW - 2 * horizMargin) / contentW,
    (targetH - topMargin - bottomMargin) / contentH,
  );
  xref = (targetW - contentW * scale) / 2 - bd.xmin * scale;
  yref = targetH - bottomMargin - bd.ymax * scale;
  void xof;
  void yof;
  ctx.save();
  ctx.scale(scale, scale);
  Layer.blit(ctx, inkLayer.ctx, { ble: "multiply", xof: xref / scale, yof: yref / scale });
  Layer.blit(ctx, colorLayer.ctx, { ble: "normal", xof: xref / scale, yof: yref / scale });
  ctx.restore();
}
