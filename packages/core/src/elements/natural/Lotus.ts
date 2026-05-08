import { prng } from "../../foundation/random";
import { fmt } from "../../utils/svg";

export interface LotusOptions {
  /** Flower radius (the big open flower). Default 80. */
  size?: number;
  /** Render the supporting stems. Default true. */
  withStem?: boolean;
  /** Render the lotus leaves behind the flowers. Default true. */
  withLeaf?: boolean;
  /** Render an additional closed bud at upper-left. Default false. */
  withBud?: boolean;
  /** Outline stroke colour. */
  lineColor?: string;
  /** Light stroke colour for veins and inner details. */
  detailColor?: string;
  /**
   * Interior fill for petals, pod and leaves.
   * Default `"white"` so back-row petals occlude correctly.
   * Pass `"none"` for pure x-ray line art.
   */
  fill?: string;
  /** Main outline stroke width. Default 1.1. */
  strokeWidth?: number;
}

export interface LotusLeafOptions {
  /** Leaf radius. Default 70. */
  radius?: number;
  /** Lobe count. Default 6. */
  lobeCount?: number;
  /** Whether to draw the fold-line. Default false. */
  withFold?: boolean;
  lineColor?: string;
  detailColor?: string;
  fill?: string;
  strokeWidth?: number;
}

interface ResolvedStyle {
  lineColor: string;
  detailColor: string;
  fillBody: string;
  podFill: string;
  strokeWidth: number;
}

function resolveStyle(opts: {
  lineColor?: string;
  detailColor?: string;
  fill?: string;
  strokeWidth?: number;
}): ResolvedStyle {
  const fill = opts.fill ?? "white";
  return {
    lineColor: opts.lineColor ?? "rgba(28,28,28,0.92)",
    detailColor: opts.detailColor ?? "rgba(70,70,70,0.55)",
    fillBody: fill,
    podFill: fill === "none" ? "white" : fill,
    strokeWidth: opts.strokeWidth ?? 1.1,
  };
}

// ── Petal ────────────────────────────────────────────────
//
// A petal is built as a curving SPINE with a width that tapers along it.
// The caller supplies per-petal shape parameters — spine bend, tip lean,
// curl asymmetry, edge-on factor — so the same primitive renders broad
// face-on petals AND thin edge-on slivers. That range is what lets a
// fan of petals feel painted instead of stamped.
//
// Local frame: the petal grows UP from the origin (its base). A petal
// with `tipY = -length, tipX = 0, bendX = 0` is straight and vertical;
// non-zero bendX/tipX bend or lean it; non-zero curl makes one edge more
// concave than the other (twist); edgeOn collapses the visible width.

interface PetalSpec {
  /** Maximum half-width at the widest point along the spine. */
  width: number;
  /** Tip offset in local frame; tipY typically negative. */
  tipX: number;
  tipY: number;
  /** Quadratic-Bezier control point that bends the spine mid-length. */
  bendX: number;
  bendY: number;
  /**
   * -1..+1. Sign chooses which edge is wider; magnitude controls how much.
   * Non-zero curl pushes the petal toward a cupped/twisted look.
   */
  curl: number;
  /**
   * 0..1. 0 = full face-on width, 1 = pure edge (a thin strip). Lets some
   * petals read as half-turned, which adds variety without 3D maths.
   */
  edgeOn: number;
  /** 0..1 = position of widest point along the spine. Default 0.45. */
  widePos?: number;
  /** Whether to draw the inner ridge curl line. Default true. */
  showCurlLine?: boolean;
}

class Petal {
  static draw(spec: PetalSpec, style: ResolvedStyle, strokeW: number): string {
    const {
      width,
      tipX,
      tipY,
      bendX,
      bendY,
      curl,
      edgeOn,
      widePos = 0.45,
      showCurlLine = true,
    } = spec;

    const visWidth = width * (1 - Math.min(0.94, edgeOn));
    const segments = 16;

    // Quadratic Bezier spine: P0=(0,0), P1=(bendX,bendY), P2=(tipX,tipY).
    // Sample (position, unit-tangent) at each step so we can lay out edges.
    type V = { x: number; y: number };
    const spine: V[] = [];
    const tangent: V[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const u = 1 - t;
      // B(t)
      const px = 2 * u * t * bendX + t * t * tipX;
      const py = 2 * u * t * bendY + t * t * tipY;
      spine.push({ x: px, y: py });
      // B'(t)
      const dx = 2 * u * bendX + 2 * t * (tipX - bendX);
      const dy = 2 * u * bendY + 2 * t * (tipY - bendY);
      const dl = Math.hypot(dx, dy) || 1;
      tangent.push({ x: dx / dl, y: dy / dl });
    }

    // Width profile: peaks at `widePos`, tapers to 0 at base and tip. The
    // two halves are independent sin curves so the shoulder and tip can be
    // weighted differently — a teardrop, a lance, an oval — by moving widePos.
    const widthAt = (t: number): number => {
      const rise = widePos > 1e-3 ? Math.sin(Math.min(1, t / widePos) * Math.PI * 0.5) : 1;
      const fall =
        1 - widePos > 1e-3 ? Math.sin(Math.min(1, (1 - t) / (1 - widePos)) * Math.PI * 0.5) : 1;
      return visWidth * Math.min(rise, fall);
    };

    // Walk the spine; place left/right edge points at perpendicular offsets.
    // `curl` makes the two halves asymmetric — one edge bulges, one cuts in.
    const left: V[] = [];
    const right: V[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const sp = spine[i]!;
      const tg = tangent[i]!;
      const nx = -tg.y;
      const ny = tg.x;
      const w = widthAt(t);
      const lf = w * (1 + curl * 0.5);
      const rf = w * (1 - curl * 0.5);
      left.push({ x: sp.x + nx * lf, y: sp.y + ny * lf });
      right.push({ x: sp.x - nx * rf, y: sp.y - ny * rf });
    }

    // Closed silhouette: walk up the right edge from base to tip, then
    // back down the left edge to base. Connect with Catmull-Rom-as-Bezier
    // so the perimeter reads as a single soft curve, not a polygon.
    const ring: V[] = [...right, ...left.slice().reverse()];
    let pathD = `M ${fmt(ring[0]!.x)} ${fmt(ring[0]!.y)}`;
    const N = ring.length;
    for (let i = 0; i < N; i++) {
      const p0 = ring[(i - 1 + N) % N]!;
      const p1 = ring[i]!;
      const p2 = ring[(i + 1) % N]!;
      const p3 = ring[(i + 2) % N]!;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      pathD += ` C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2.x)} ${fmt(p2.y)}`;
    }
    pathD += ` Z`;

    let out = `<path d="${pathD}" fill="${style.fillBody}" stroke="${style.lineColor}" stroke-width="${fmt(strokeW)}"/>`;

    // Inner curl ridge — a single curve running along the spine, offset
    // toward the *concave* side (opposite the curl direction), so it reads
    // as a fold along the cup's interior rather than as a stripe on the
    // petal's back. Skip on edge-on petals where it would overlap.
    if (showCurlLine && edgeOn < 0.6) {
      const side = curl >= 0 ? -1 : 1;
      const cSegs = 10;
      const startT = 0.12;
      const endT = 0.92;
      const ridge: V[] = [];
      for (let i = 0; i <= cSegs; i++) {
        const t = startT + (endT - startT) * (i / cSegs);
        const u = 1 - t;
        const sx = 2 * u * t * bendX + t * t * tipX;
        const sy = 2 * u * t * bendY + t * t * tipY;
        const dx = 2 * u * bendX + 2 * t * (tipX - bendX);
        const dy = 2 * u * bendY + 2 * t * (tipY - bendY);
        const dl = Math.hypot(dx, dy) || 1;
        const nx = -dy / dl;
        const ny = dx / dl;
        const w = widthAt(t) * 0.45 * side;
        ridge.push({ x: sx + nx * w, y: sy + ny * w });
      }
      let rD = `M ${fmt(ridge[0]!.x)} ${fmt(ridge[0]!.y)}`;
      const Nr = ridge.length;
      for (let i = 0; i < Nr - 1; i++) {
        const p0 = (i > 0 ? ridge[i - 1] : ridge[i])!;
        const p1 = ridge[i]!;
        const p2 = ridge[i + 1]!;
        const p3 = (i + 2 < Nr ? ridge[i + 2] : ridge[i + 1])!;
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;
        rD += ` C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2.x)} ${fmt(p2.y)}`;
      }
      out += `<path d="${rD}" fill="none" stroke="${style.lineColor}" stroke-width="${fmt(strokeW * 0.55)}"/>`;
    }

    return out;
  }
}

// ── Leaf ─────────────────────────────────────────────────
//
// Round lotus pad with 5–7 distinct lobes, palmate venation and an
// optional fold. Built in three stages:
//   A. Lobe schema — alternating peak/valley points around 2π
//   B. Outline — Catmull-Rom-as-Bezier through all points (closed)
//   C. Veining — main veins from a slightly off-centre stem-attachment
//      point to each lobe peak, plus secondary veins between mains
//
// The y-axis is squashed by `yScale` so the disk reads as a leaf viewed
// at a slight angle, not a perfect circle.

class Leaf {
  static draw(
    radius: number,
    lobeCount: number,
    stemAngle: number,
    withFold: boolean,
    style: ResolvedStyle,
  ): string {
    const r = radius;
    const n = Math.max(3, Math.min(9, lobeCount));
    const yScale = 0.6 + prng.next() * 0.06;

    // Stage A/B — outline. Sample the perimeter densely and modulate the
    // radius with one sine wave that has `n` periods (the lobe peaks) plus
    // a tiny higher-frequency wobble. With ~80 samples and a small lobe
    // amplitude, the silhouette reads as a softly scalloped disc, not a
    // jagged star polygon — which is what the previous peak/valley
    // Catmull-Rom approach was producing.
    const lobeOffset = prng.next() * Math.PI * 2;
    const lobeAmp = 0.055 + prng.next() * 0.025;
    const microPhase = prng.next() * 100;

    type P = { x: number; y: number };
    const steps = 80;
    const pts: P[] = [];
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const a = t * Math.PI * 2;
      const lobeWave = Math.sin(a * n + lobeOffset);
      const microWave = Math.sin(a * n * 3 + microPhase) * 0.012;
      const radial = r * (0.95 + lobeAmp * lobeWave + microWave);
      pts.push({
        x: Math.cos(a) * radial,
        y: Math.sin(a) * radial * yScale,
      });
    }

    let pathD = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
    const N = pts.length;
    for (let i = 0; i < N; i++) {
      const p0 = pts[(i - 1 + N) % N];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % N];
      const p3 = pts[(i + 2) % N];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      pathD += ` C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2.x)} ${fmt(p2.y)}`;
    }
    pathD += ` Z`;

    let svg = `<g>`;
    svg += `<path d="${pathD}" fill="${style.fillBody}" stroke="${style.lineColor}" stroke-width="${fmt(style.strokeWidth * 0.9)}"/>`;

    // Lobe peaks land where sin(a*n + lobeOffset) = 1
    //   ⇒ a*n + lobeOffset = π/2 + 2π·k
    //   ⇒ a = (π/2 - lobeOffset)/n + 2π·k/n
    const peakAngle = (k: number) => (Math.PI / 2 - lobeOffset) / n + (Math.PI * 2 * k) / n;
    const valleyAngle = (k: number) => (-Math.PI / 2 - lobeOffset) / n + (Math.PI * 2 * k) / n;

    // Stage C — venation. Stem attachment is offset slightly toward the
    // edge that the stem comes from, so veins fan from there rather than
    // a perfect centre.
    const stemX = Math.cos(stemAngle) * r * 0.08;
    const stemY = Math.sin(stemAngle) * r * 0.08 * yScale;

    for (let i = 0; i < n; i++) {
      const pa = peakAngle(i);
      const pr = r * (1 + lobeAmp) * 0.9;
      const ex = Math.cos(pa) * pr;
      const ey = Math.sin(pa) * pr * yScale;
      const bend = (prng.next() - 0.5) * 0.14;
      const cx = (stemX + ex) * 0.5 + Math.sin(pa) * r * bend;
      const cy = (stemY + ey) * 0.5 - Math.cos(pa) * r * bend * yScale;
      svg += `<path d="M ${fmt(stemX)} ${fmt(stemY)} Q ${fmt(cx)} ${fmt(cy)} ${fmt(ex)} ${fmt(ey)}" stroke="${style.detailColor}" stroke-width="${fmt(style.strokeWidth * 0.5)}" fill="none"/>`;

      // Secondary veins branching toward an adjacent valley.
      const branchCount = 1 + (prng.next() < 0.45 ? 1 : 0);
      for (let b = 0; b < branchCount; b++) {
        const bt = 0.42 + b * 0.22 + prng.next() * 0.1;
        const bsx = stemX + (ex - stemX) * bt;
        const bsy = stemY + (ey - stemY) * bt;
        const targetA = b === 0 ? valleyAngle(i) : valleyAngle(i + 1);
        const blen = pr * (0.16 + prng.next() * 0.1);
        const bex = bsx + Math.cos(targetA) * blen;
        const bey = bsy + Math.sin(targetA) * blen * yScale;
        const bbend = (prng.next() - 0.5) * 0.18;
        const bcx = (bsx + bex) * 0.5 + Math.sin(targetA) * blen * bbend;
        const bcy = (bsy + bey) * 0.5 - Math.cos(targetA) * blen * bbend * yScale;
        svg += `<path d="M ${fmt(bsx)} ${fmt(bsy)} Q ${fmt(bcx)} ${fmt(bcy)} ${fmt(bex)} ${fmt(bey)}" stroke="${style.detailColor}" stroke-width="${fmt(style.strokeWidth * 0.32)}" fill="none"/>`;
      }
    }

    if (withFold) {
      // Fold line crosses the leaf, parallel to the edge opposite the stem.
      const foldA = stemAngle + Math.PI;
      const foldOffset = 0.3 + prng.next() * 0.15;
      const fx1 = Math.cos(foldA - 0.85) * r * 0.7;
      const fy1 = Math.sin(foldA - 0.85) * r * 0.7 * yScale;
      const fx2 = Math.cos(foldA + 0.85) * r * 0.7;
      const fy2 = Math.sin(foldA + 0.85) * r * 0.7 * yScale;
      const fcx = Math.cos(foldA) * r * foldOffset;
      const fcy = Math.sin(foldA) * r * foldOffset * yScale;
      svg += `<path d="M ${fmt(fx1)} ${fmt(fy1)} Q ${fmt(fcx)} ${fmt(fcy)} ${fmt(fx2)} ${fmt(fy2)}" stroke="${style.lineColor}" stroke-width="${fmt(style.strokeWidth * 0.7)}" fill="none"/>`;
    }

    svg += `<circle cx="${fmt(stemX)}" cy="${fmt(stemY)}" r="${fmt(Math.max(0.6, r * 0.022))}" fill="${style.lineColor}"/>`;

    svg += `</g>`;
    return svg;
  }
}

// ── Stem ─────────────────────────────────────────────────
//
// Lotus stems are mostly vertical but visibly wavy — gentle S-curves with
// 1–2 inflection points. Sample N points along the line, displace each
// perpendicular to the line by a tapered sine wave, then connect with a
// Catmull-Rom-as-Bezier path so the curve reads smooth, not segmented.

class Stem {
  static draw(x1: number, y1: number, x2: number, y2: number, style: ResolvedStyle): string {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;

    const segments = 8;
    const swayAmp = length * (0.05 + prng.next() * 0.04);
    const freq = 1.1 + prng.next() * 0.9;
    const phase = prng.next() * Math.PI * 2;
    const dir = prng.next() < 0.5 ? -1 : 1;

    type P = { x: number; y: number };
    const pts: P[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const baseX = x1 + dx * t;
      const baseY = y1 + dy * t;
      // Taper: zero displacement at endpoints, max in the middle, so the
      // stem still meets the flower base and the water-line cleanly.
      const taper = Math.sin(t * Math.PI);
      const sway = Math.sin(t * Math.PI * freq + phase) * swayAmp * taper * dir;
      pts.push({ x: baseX + nx * sway, y: baseY + ny * sway });
    }

    let pathD = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
    const N = pts.length;
    for (let i = 0; i < N - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i + 2 < N ? pts[i + 2] : pts[i + 1];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      pathD += ` C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2.x)} ${fmt(p2.y)}`;
    }

    return `<path d="${pathD}" stroke="${style.lineColor}" stroke-width="${fmt(style.strokeWidth * 0.8)}" fill="none"/>`;
  }
}

// ── Pod + stamens (side view) ────────────────────────────
//
// Side-view shows the seed pod as a small flattened oval at the top of
// the inner cup, with the pod's seed-cavity rim hinted on its upper
// edge. The stamens (花蕊) are slim filaments emerging from around the
// pod's upper rim, each curving up and outward and ending in a small
// oriented anther stub. Stamens are drawn FIRST so the pod's body
// covers their bases — what reads visually is just the upper portion:
// a halo of fine hairs and dark anther tips peeking around the pod.

function drawPodHint(
  x: number,
  y: number,
  w: number,
  h: number,
  style: ResolvedStyle,
  strokeW: number,
): string {
  let out = `<g transform="translate(${fmt(x)} ${fmt(y)})">`;

  // ── Stamens ─────────────────────────────────────────
  // Distribute filaments along the front-facing upper arc of the pod
  // (-160° to -20° in screen polar, i.e., upper-left → up → upper-right).
  // Each stamen's tip rises well above the pod, with random lateral drift
  // and a quadratic curve so no two read identically.
  const stamenCount = 9 + Math.floor(prng.next() * 4);
  for (let i = 0; i < stamenCount; i++) {
    const t = (i + 0.5) / stamenCount;
    const baseAngle = ((-160 + t * 140) * Math.PI) / 180;

    // Base just inside the pod's upper rim; pod fill will cover this.
    const baseR = w * (0.7 + prng.next() * 0.2);
    const sx = Math.cos(baseAngle) * baseR;
    const sy = Math.sin(baseAngle) * h * 0.7;

    // Tip rises upward; lateral spread is biased outward so side-stamens
    // splay sideways while centre-stamens climb mostly vertical.
    const reachUp = h * (1.7 + prng.next() * 1.5);
    const drift = (prng.next() - 0.5) * 0.5;
    const tx = sx + Math.cos(baseAngle) * w * 0.4 + drift * w * 0.4;
    const ty = sy - reachUp;

    // Filament curve: control point pulled high so the line bows over.
    const ctrlX = (sx + tx) * 0.5 + (prng.next() - 0.5) * w * 0.12;
    const ctrlY = sy - reachUp * 0.55 + (prng.next() - 0.5) * h * 0.2;

    out += `<path d="M ${fmt(sx)} ${fmt(sy)} Q ${fmt(ctrlX)} ${fmt(ctrlY)} ${fmt(tx)} ${fmt(ty)}" fill="none" stroke="${style.lineColor}" stroke-width="${fmt(strokeW * 0.4)}" stroke-linecap="round"/>`;

    // Anther — short stub aligned with the filament's tip-tangent. The
    // stub extends slightly past the filament end (paddle-shaped bulb)
    // to read as a discrete organ rather than a fattened line-cap.
    const antherLen = strokeW * (1.5 + prng.next() * 0.7);
    const antherW = strokeW * (0.55 + prng.next() * 0.3);
    const dirX = tx - ctrlX;
    const dirY = ty - ctrlY;
    const dirLen = Math.hypot(dirX, dirY) || 1;
    const ux = dirX / dirLen;
    const uy = dirY / dirLen;
    const ax1 = tx - ux * antherLen * 0.35;
    const ay1 = ty - uy * antherLen * 0.35;
    const ax2 = tx + ux * antherLen * 0.65;
    const ay2 = ty + uy * antherLen * 0.65;
    out += `<line x1="${fmt(ax1)}" y1="${fmt(ay1)}" x2="${fmt(ax2)}" y2="${fmt(ay2)}" stroke="${style.lineColor}" stroke-width="${fmt(antherW)}" stroke-linecap="round"/>`;
  }

  // ── Pod body ────────────────────────────────────────
  out += `<ellipse cx="0" cy="0" rx="${fmt(w)}" ry="${fmt(h)}" fill="${style.podFill}" stroke="${style.lineColor}" stroke-width="${fmt(strokeW * 0.85)}"/>`;
  // Upper rim arch — suggests the pod's seed-face curves upward.
  out += `<path d="M ${fmt(-w * 0.9)} ${fmt(-h * 0.05)} Q 0 ${fmt(-h * 0.85)} ${fmt(w * 0.9)} ${fmt(-h * 0.05)}" fill="none" stroke="${style.lineColor}" stroke-width="${fmt(strokeW * 0.6)}"/>`;

  // ── Seed pips ───────────────────────────────────────
  // Vary count, spacing, vertical position, and size so the pips read as
  // individual seed cavities rather than a regular row.
  const pipCount = 3 + Math.floor(prng.next() * 2);
  for (let i = 0; i < pipCount; i++) {
    const t = (i + 0.5) / pipCount;
    const px = (t - 0.5) * w * 1.4 + (prng.next() - 0.5) * w * 0.08;
    const py = -h * (0.1 + prng.next() * 0.22);
    const pr = w * (0.085 + prng.next() * 0.04);
    out += `<ellipse cx="${fmt(px)}" cy="${fmt(py)}" rx="${fmt(pr)}" ry="${fmt(pr * 0.65)}" fill="none" stroke="${style.lineColor}" stroke-width="${fmt(strokeW * 0.5)}"/>`;
  }

  out += `</g>`;
  return out;
}

// ── Bud ──────────────────────────────────────────────────
//
// Tightly closed bud — a pointed almond envelope with a couple of
// overlapping sepal lines. Optional element, off by default.

class Bud {
  static draw(x: number, y: number, size: number, style: ResolvedStyle): string {
    const s = size;
    const w = s * 0.45;
    const h = s * 1.3;
    let svg = `<g transform="translate(${fmt(x)} ${fmt(y)}) rotate(-12)">`;
    svg += `<path d="M 0 0 Q ${fmt(w)} ${fmt(-h * 0.5)} 0 ${fmt(-h)} Q ${fmt(-w)} ${fmt(-h * 0.5)} 0 0 Z" fill="${style.fillBody}" stroke="${style.lineColor}" stroke-width="${fmt(style.strokeWidth)}"/>`;
    svg += `<path d="M ${fmt(-w * 0.4)} ${fmt(-h * 0.2)} Q ${fmt(-w * 0.05)} ${fmt(-h * 0.6)} ${fmt(w * 0.5)} ${fmt(-h * 0.55)}" stroke="${style.lineColor}" stroke-width="${fmt(style.strokeWidth * 0.85)}" fill="none"/>`;
    svg += `<path d="M ${fmt(w * 0.35)} ${fmt(-h * 0.18)} Q ${fmt(w * 0.05)} ${fmt(-h * 0.55)} ${fmt(-w * 0.45)} ${fmt(-h * 0.45)}" stroke="${style.lineColor}" stroke-width="${fmt(style.strokeWidth * 0.8)}" fill="none"/>`;
    svg += `</g>`;
    return svg;
  }
}

// ── Lotus (composition) ──────────────────────────────────
//
// Public API. Two open flowers stacked vertically, three lobed leaves
// dominating the right side, optional bud at upper-left, stems running
// to a base point near the bottom edge. Layered back-to-front:
// leaves → stems → bud → flowers (each flower includes its own pod
// drawn over its own petals' centres).

export class Lotus {
  static generate(xoff: number, yoff: number, seed: number, options: LotusOptions = {}): string {
    prng.seed(seed);

    const size = options.size ?? 80;
    const withStem = options.withStem ?? true;
    const withLeaf = options.withLeaf ?? true;
    const withBud = options.withBud ?? false;
    const style = resolveStyle(options);

    const big = { x: xoff, y: yoff, scale: 1 };
    const mid = { x: xoff - size * 0.45, y: yoff + size * 1.5, scale: 0.78 };
    const baseX = xoff - size * 0.05;
    const baseY = yoff + size * 3.4;

    let svg = `<g class="shuimo-lotus" stroke-linecap="round" stroke-linejoin="round">`;

    if (withLeaf) {
      svg += `<g transform="translate(${fmt(xoff + size * 1.3)} ${fmt(yoff + size * 0.45)})">`;
      svg += Leaf.draw(size * 1.05, 6, Math.PI * 0.95, true, style);
      svg += `</g>`;

      svg += `<g transform="translate(${fmt(xoff + size * 0.95)} ${fmt(yoff + size * 1.95)})">`;
      svg += Leaf.draw(size * 0.95, 7, Math.PI * 1.05, false, style);
      svg += `</g>`;

      svg += `<g transform="translate(${fmt(xoff + size * 0.55)} ${fmt(yoff + size * 2.85)})">`;
      svg += Leaf.draw(size * 0.6, 5, Math.PI * 1.2, false, style);
      svg += `</g>`;
    }

    if (withStem) {
      svg += Stem.draw(big.x - size * 0.06, big.y + size * 0.55, baseX, baseY, style);
      svg += Stem.draw(mid.x, mid.y + size * 0.5, baseX + size * 0.05, baseY, style);
      if (withBud) {
        const budX = xoff - size * 1.25;
        const budY = yoff + size * 0.05;
        svg += Stem.draw(
          budX + size * 0.05,
          budY + size * 0.5,
          baseX - size * 0.1,
          yoff + size * 1.85,
          style,
        );
      }
    }

    if (withBud) {
      svg += Bud.draw(xoff - size * 1.25, yoff + size * 0.05, size * 0.6, style);
    }

    svg += this.drawFlowerHead(mid.x, mid.y, size * mid.scale, style);
    svg += this.drawFlowerHead(big.x, big.y, size * big.scale, style);

    svg += `</g>`;
    return svg;
  }

  static flower(xoff: number, yoff: number, seed: number, options: LotusOptions = {}): string {
    prng.seed(seed);
    const size = options.size ?? 80;
    const style = resolveStyle(options);
    return [
      `<g class="shuimo-lotus-flower" stroke-linecap="round" stroke-linejoin="round">`,
      this.drawFlowerHead(xoff, yoff, size, style),
      `</g>`,
    ].join("");
  }

  static leaf(xoff: number, yoff: number, seed: number, options: LotusLeafOptions = {}): string {
    prng.seed(seed);
    const radius = options.radius ?? 70;
    const lobeCount = options.lobeCount ?? 6;
    const withFold = options.withFold ?? false;
    const style = resolveStyle(options);
    return [
      `<g class="shuimo-lotus-leaf" stroke-linecap="round" stroke-linejoin="round" transform="translate(${fmt(xoff)} ${fmt(yoff)})">`,
      Leaf.draw(radius, lobeCount, Math.PI * 0.5, withFold, style),
      `</g>`,
    ].join("");
  }

  // ─── flower-head composition ──────────────────────────

  private static drawFlowerHead(x: number, y: number, size: number, style: ResolvedStyle): string {
    const s = size;
    const lineW = style.strokeWidth;

    // Side-view "blooming" lotus, in three layers:
    //
    //   1. Inner cup — 3 nearly-upright petals tightly hugging the pod,
    //      forming the bud-like centre.
    //   2. Outer petals — 5–7 unfurled petals at angles all around the
    //      cup (skipping straight-down, where the stem attaches). Each
    //      petal carries its own length, width, bend, curl, edge-on so
    //      the silhouette breaks symmetry the way a painted lotus does.
    //   3. Pod hint and base sepals.
    //
    // Render order is depth-sorted using the petal's rotation: petals
    // pointing up (toward the back of the flower) draw FIRST and end up
    // behind the cup; petals pointing toward the viewer's lower hemisphere
    // draw LAST and overlap the cup. The depth axis is `1 - cos(angle)`,
    // which is 0 at "up" and 2 at "down" — the natural front-back axis
    // for a flower whose face points sideways into the picture plane.

    type Item = { angle: number; offsetY: number; spec: PetalSpec; depth: number };
    const items: Item[] = [];

    // ── Inner cup ───────────────────────────────────────
    const innerN = 3;
    for (let i = 0; i < innerN; i++) {
      const t = i / (innerN - 1);
      const angle = (t - 0.5) * 26; // narrow 26° fan, centred up
      const len = s * (0.62 + prng.next() * 0.08);
      const wid = s * (0.22 + prng.next() * 0.04);
      const tipX = (t - 0.5) * s * 0.06;
      const bendX = (t - 0.5) * s * 0.04;
      // Side cup-petals are seen more edge-on than the centre one.
      const edgeOn = 0.06 + Math.abs(t - 0.5) * 0.55;
      const curl = (t - 0.5) * 0.5;
      items.push({
        angle,
        offsetY: -s * 0.04,
        // Inner cup sits in the middle of the depth stack so a few outer
        // petals draw in front of it and the rest draw behind.
        depth: 0.85 + Math.abs(t - 0.5) * 0.05,
        spec: {
          width: wid,
          tipX,
          tipY: -len,
          bendX,
          bendY: -len * 0.5,
          curl,
          edgeOn,
          widePos: 0.5,
          showCurlLine: edgeOn < 0.4,
        },
      });
    }

    // ── Outer petals ────────────────────────────────────
    const outerN = 6 + (prng.next() < 0.45 ? 1 : 0);
    const minA = -165;
    const maxA = 165;
    const span = maxA - minA;
    for (let i = 0; i < outerN; i++) {
      // Stratified sampling: split the angular range into bands, jitter
      // within each band. Avoids clumping you'd get from pure random.
      const slot = (i + 0.5) / outerN;
      const jitter = ((prng.next() - 0.5) * 0.7) / outerN;
      const t = Math.max(0, Math.min(1, slot + jitter));
      const angle = minA + span * t;

      const len = s * (0.85 + prng.next() * 0.35);
      const wid = s * (0.3 + prng.next() * 0.12);

      // 1-in-4 petals are turned aside, showing edge rather than face.
      const turnedAside = prng.next() < 0.24;
      const edgeOn = turnedAside ? 0.55 + prng.next() * 0.3 : 0.06 + prng.next() * 0.18;

      // Petals pointing further from "up" tend to droop their tips outward,
      // so curl is biased away from the centreline for low-hemisphere petals.
      const upness = Math.cos((angle * Math.PI) / 180);
      const droop = (1 - upness) * 0.25;
      const baseCurl = (prng.next() - 0.5) * 0.7;
      const curl = baseCurl + (angle > 0 ? -droop : droop);

      const tipX = (prng.next() - 0.5) * wid * 0.6;
      const bendDir = prng.next() < 0.5 ? -1 : 1;
      const bendX = bendDir * wid * (0.15 + prng.next() * 0.25);
      const bendY = -len * (0.42 + prng.next() * 0.12);

      items.push({
        angle,
        offsetY: -s * 0.04,
        depth: 1 - upness, // 0 (up/back) → 2 (down/front)
        spec: {
          width: wid,
          tipX,
          tipY: -len,
          bendX,
          bendY,
          curl,
          edgeOn,
          widePos: 0.4 + prng.next() * 0.15,
          showCurlLine: !turnedAside,
        },
      });
    }

    items.sort((a, b) => a.depth - b.depth);

    let svg = `<g transform="translate(${fmt(x)} ${fmt(y)})">`;

    for (const it of items) {
      svg += `<g transform="rotate(${fmt(it.angle)}) translate(0 ${fmt(it.offsetY)})">`;
      svg += Petal.draw(it.spec, style, lineW);
      svg += `</g>`;
    }

    // Pod hint inside the inner cup, near the top.
    svg += drawPodHint(0, -s * 0.5, s * 0.16, s * 0.07, style, lineW);

    // Sepals/bracts: small narrow leaves at the base, between the flower
    // and the stem. A lotus has 4 sepals; we render 2–3 visible ones.
    const sepalCount = 2 + Math.floor(prng.next() * 2);
    for (let i = 0; i < sepalCount; i++) {
      const sa = 180 + (i - (sepalCount - 1) / 2) * 14 + (prng.next() - 0.5) * 6;
      const sl = s * (0.16 + prng.next() * 0.08);
      const sw = s * 0.045;
      svg += `<g transform="rotate(${fmt(sa)})">`;
      svg += `<path d="M 0 0 Q ${fmt(sw)} ${fmt(-sl * 0.55)} 0 ${fmt(-sl)} Q ${fmt(-sw)} ${fmt(-sl * 0.55)} 0 0 Z" fill="${style.fillBody}" stroke="${style.lineColor}" stroke-width="${fmt(lineW * 0.7)}"/>`;
      svg += `</g>`;
    }

    svg += `</g>`;
    return svg;
  }
}

export function lotus(xoff: number, yoff: number, seed: number, options?: LotusOptions): string {
  return Lotus.generate(xoff, yoff, seed, options);
}

export function lotusFlower(
  xoff: number,
  yoff: number,
  seed: number,
  options?: LotusOptions,
): string {
  return Lotus.flower(xoff, yoff, seed, options);
}

export function lotusLeaf(
  xoff: number,
  yoff: number,
  seed: number,
  options?: LotusLeafOptions,
): string {
  return Lotus.leaf(xoff, yoff, seed, options);
}
