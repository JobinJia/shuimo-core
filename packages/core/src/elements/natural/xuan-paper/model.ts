import { GaborNoise, WorleyNoise } from "../../../foundation/noise";
import { PRNG } from "../../../foundation/random";
import { DEFAULT_BASE_COLOR, XuanPaperColors } from "./presets";
import type {
  DeckleOutline,
  FiberStroke,
  GoldFleck,
  GoldPathCommand,
  GrainParticle,
  NormalizedXuanPaperOptions,
  PaperPoint,
  XuanPaperKind,
  XuanPaperOptions,
  XuanPaperProfile,
  XuanPaperScene,
} from "./types";

const TWO_PI = Math.PI * 2;

const SEED_OFFSETS = {
  tone: 101,
  formation: 307,
  detail: 509,
  fibers: 809,
  particles: 1103,
  aging: 1601,
  gold: 2203,
  deckle: 2801,
} as const;

// ---------------------------------------------------------------------------
// utility
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function adjustColor(
  color: [number, number, number],
  deltas: [number, number, number],
): [number, number, number] {
  return [
    clamp(round(color[0] + deltas[0]), 0, 255),
    clamp(round(color[1] + deltas[1]), 0, 255),
    clamp(round(color[2] + deltas[2]), 0, 255),
  ];
}

function distance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function gaussianSample(rng: PRNG): number {
  const u1 = Math.max(1e-9, rng.next());
  const u2 = rng.next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(TWO_PI * u2);
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return d;
}

// Gabor returns an undirected orientation in [-π/2, π/2]. Pick whichever of the
// two physically-equivalent headings (θ or θ+π) is closer to the fiber's
// current travel direction so growth flows without U-turns.
function nearestHeading(undirected: number, currentHeading: number): number {
  const opt1 = undirected;
  const opt2 = undirected + Math.PI;
  return Math.abs(angleDiff(opt1, currentHeading)) < Math.abs(angleDiff(opt2, currentHeading))
    ? opt1
    : opt2;
}

// ---------------------------------------------------------------------------
// profile
// ---------------------------------------------------------------------------

function resolvePaperKind(baseColor: [number, number, number]): XuanPaperKind {
  const presets: Array<{ color: [number, number, number]; kind: XuanPaperKind }> = [
    { color: XuanPaperColors.raw, kind: "raw" },
    { color: XuanPaperColors.moonWhite, kind: "raw" },
    { color: XuanPaperColors.processed, kind: "halfSized" },
    { color: XuanPaperColors.antique, kind: "sized" },
    { color: XuanPaperColors.teaStained, kind: "sized" },
  ];

  let closest = presets[0]!;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const preset of presets) {
    const currentDistance = distance(baseColor, preset.color);
    if (currentDistance < closestDistance) {
      closest = preset;
      closestDistance = currentDistance;
    }
  }

  return closest.kind;
}

export function normalizeXuanPaperOptions(
  options: XuanPaperOptions = {},
): NormalizedXuanPaperOptions {
  const goldSizeMin = clamp(options.goldSize?.[0] ?? 2, 0.5, 32);
  const goldSizeMax = clamp(options.goldSize?.[1] ?? 12, goldSizeMin, 48);

  return {
    width: clamp(round(options.width ?? 800), 1, 4096),
    height: clamp(round(options.height ?? 600), 1, 4096),
    baseColor: options.baseColor ?? DEFAULT_BASE_COLOR,
    fiberDensity: clamp(options.fiberDensity ?? 1, 0, 4),
    fiberScale: clamp(options.fiberScale ?? 1, 0.2, 3),
    textureIntensity: clamp(options.textureIntensity ?? 0.3, 0, 1),
    grainDensity: clamp(options.grainDensity ?? 0.5, 0, 1),
    age: clamp(options.age ?? 0, 0, 1),
    deckleEdge: options.deckleEdge ?? false,
    deckleRoughness: clamp(options.deckleRoughness ?? 0.5, 0, 1),
    seed: options.seed ?? Date.now(),
    mode: options.mode ?? "canvas",
    goldFlecks: options.goldFlecks ?? false,
    goldDensity: clamp(options.goldDensity ?? 0.5, 0, 1),
    goldSize: [goldSizeMin, goldSizeMax],
    goldColor: options.goldColor ?? [218, 165, 32],
    goldClustering: clamp(options.goldClustering ?? 0.3, 0, 1),
    goldDistribution: options.goldDistribution ?? "poisson",
  };
}

export function buildXuanPaperProfile(options: NormalizedXuanPaperOptions): XuanPaperProfile {
  const kind = resolvePaperKind(options.baseColor);

  const profileByKind: Record<XuanPaperKind, XuanPaperProfile> = {
    raw: {
      kind,
      warmth: 0.12,
      fiberContrast: 1.2,
      fiberLengthMultiplier: 1.18,
      formationContrast: 1.05,
      grainSoftness: 0.78,
      particleContrast: 0.88,
      patinaStrength: 0.65,
      deckleSoftness: 0.82,
      absorbency: 1.1,
    },
    halfSized: {
      kind,
      warmth: 0.2,
      fiberContrast: 1.0,
      fiberLengthMultiplier: 1.0,
      formationContrast: 0.95,
      grainSoftness: 1.0,
      particleContrast: 0.96,
      patinaStrength: 0.9,
      deckleSoftness: 1.0,
      absorbency: 0.88,
    },
    sized: {
      kind,
      warmth: 0.34,
      fiberContrast: 0.82,
      fiberLengthMultiplier: 0.9,
      formationContrast: 0.74,
      grainSoftness: 1.14,
      particleContrast: 1.04,
      patinaStrength: 1.12,
      deckleSoftness: 1.18,
      absorbency: 0.65,
    },
  };

  return profileByKind[kind];
}

// ---------------------------------------------------------------------------
// fibers: Gabor direction field + Thomas cluster process
// ---------------------------------------------------------------------------

interface ThomasCluster {
  x: number;
  y: number;
  sigma: number;
}

function sampleThomasClusters(width: number, height: number, rng: PRNG): ThomasCluster[] {
  const area = width * height;
  const count = Math.max(2, Math.round(area / 48000));
  const baseSigma = Math.sqrt(area / count) * 0.32;
  const clusters: ThomasCluster[] = [];
  for (let i = 0; i < count; i++) {
    clusters.push({
      x: rng.next() * width,
      y: rng.next() * height,
      sigma: baseSigma * (0.7 + rng.next() * 0.6),
    });
  }
  return clusters;
}

function pickAnchor(
  width: number,
  height: number,
  rng: PRNG,
  clusters: ThomasCluster[],
  clusterProbability: number,
): { x: number; y: number } {
  if (clusters.length > 0 && rng.next() < clusterProbability) {
    const cluster = clusters[Math.floor(rng.next() * clusters.length)]!;
    return {
      x: cluster.x + gaussianSample(rng) * cluster.sigma,
      y: cluster.y + gaussianSample(rng) * cluster.sigma,
    };
  }
  return { x: rng.next() * width, y: rng.next() * height };
}

function growFiber(
  anchorX: number,
  anchorY: number,
  directionField: GaborNoise,
  rng: PRNG,
  segmentLength: number,
  forwardSteps: number,
  backwardSteps: number,
  turnJitter: number,
): PaperPoint[] {
  const anchorAngle = directionField.directionAt(anchorX, anchorY);

  // Backward growth (opposite heading).
  const backPoints: PaperPoint[] = [];
  let bx = anchorX;
  let by = anchorY;
  let bHeading = anchorAngle + Math.PI;
  for (let i = 0; i < backwardSteps; i++) {
    const fieldAngle = directionField.directionAt(bx, by);
    bHeading = nearestHeading(fieldAngle, bHeading) + (rng.next() - 0.5) * turnJitter;
    bx += Math.cos(bHeading) * segmentLength;
    by += Math.sin(bHeading) * segmentLength;
    backPoints.push({ x: bx, y: by });
  }
  backPoints.reverse();

  const points: PaperPoint[] = [...backPoints, { x: anchorX, y: anchorY }];

  // Forward growth.
  let fx = anchorX;
  let fy = anchorY;
  let fHeading = anchorAngle;
  for (let i = 0; i < forwardSteps; i++) {
    const fieldAngle = directionField.directionAt(fx, fy);
    fHeading = nearestHeading(fieldAngle, fHeading) + (rng.next() - 0.5) * turnJitter;
    fx += Math.cos(fHeading) * segmentLength;
    fy += Math.sin(fHeading) * segmentLength;
    points.push({ x: fx, y: fy });
  }

  return points;
}

function generateFibers(
  options: NormalizedXuanPaperOptions,
  profile: XuanPaperProfile,
): FiberStroke[] {
  const rng = new PRNG();
  rng.seed(options.seed + SEED_OFFSETS.fibers);

  const area = options.width * options.height;
  const mainCount = Math.floor(area * options.fiberDensity * 0.00012 * profile.fiberContrast);
  const fragmentCount = Math.floor(mainCount * (0.22 + profile.absorbency * 0.08));

  // Paper-scale Gabor field. Raw xuan (high absorbency) shows looser fiber
  // alignment; sized paper is tighter. Main orientation is a mild tilt off
  // horizontal so the grain does not read as machine-perfect.
  const orientationTilt = (rng.next() - 0.5) * 0.3;
  const directionField = new GaborNoise(options.seed + SEED_OFFSETS.fibers, {
    frequency: 38 * options.fiberScale,
    kernelRadius: 62 * options.fiberScale,
    mainOrientation: orientationTilt,
    orientationConcentration: mix(1.6, 0.35, clamp(profile.absorbency - 0.5, 0, 1)),
    kernelsPerCell: 3,
  });

  const clusters = sampleThomasClusters(options.width, options.height, rng);
  const fibers: FiberStroke[] = [];

  for (let index = 0; index < mainCount; index++) {
    const anchor = pickAnchor(options.width, options.height, rng, clusters, 0.58);
    const strokeLength =
      (85 + rng.next() * 160) * options.fiberScale * profile.fiberLengthMultiplier;
    const segments = 15 + Math.floor(rng.next() * 15);
    const segmentLength = strokeLength / segments;
    const forwardSteps = Math.floor(segments * (0.42 + rng.next() * 0.16));
    const backwardSteps = segments - forwardSteps;

    const points = growFiber(
      anchor.x,
      anchor.y,
      directionField,
      rng,
      segmentLength,
      forwardSteps,
      backwardSteps,
      0.12,
    );

    const darkness = 46;
    const warmthLift = profile.warmth * 18;
    const color = adjustColor(options.baseColor, [
      -(darkness - warmthLift),
      -(darkness + 5 - warmthLift * 0.6),
      -(darkness + 14),
    ]);

    fibers.push({
      points,
      width: 0.28 + rng.next() * 0.42,
      color,
      alpha: 0.05 + rng.next() * 0.08 * profile.fiberContrast,
    });
  }

  for (let index = 0; index < fragmentCount; index++) {
    const anchor = pickAnchor(options.width, options.height, rng, clusters, 0.12);
    const strokeLength =
      (28 + rng.next() * 54) * options.fiberScale * profile.fiberLengthMultiplier;
    const segments = 7 + Math.floor(rng.next() * 7);
    const segmentLength = strokeLength / segments;

    const points = growFiber(
      anchor.x,
      anchor.y,
      directionField,
      rng,
      segmentLength,
      segments,
      0,
      0.3,
    );

    const darkness = 60;
    const warmthLift = profile.warmth * 18;
    const color = adjustColor(options.baseColor, [
      -(darkness - warmthLift),
      -(darkness + 5 - warmthLift * 0.6),
      -(darkness + 14),
    ]);

    fibers.push({
      points,
      width: 0.35 + rng.next() * 0.55,
      color,
      alpha: 0.08 + rng.next() * 0.08 * profile.fiberContrast,
    });
  }

  return fibers;
}

// ---------------------------------------------------------------------------
// grain particles: Worley F2-F1 edge bias
// ---------------------------------------------------------------------------

function generateParticles(
  options: NormalizedXuanPaperOptions,
  profile: XuanPaperProfile,
): GrainParticle[] {
  const rng = new PRNG();
  rng.seed(options.seed + SEED_OFFSETS.particles);

  const worley = new WorleyNoise(options.seed + SEED_OFFSETS.particles + 37);
  const area = options.width * options.height;
  const count = Math.floor(area * options.grainDensity * 0.0016 * profile.particleContrast);
  const particles: GrainParticle[] = [];

  const cellSize = 14 + (1 - options.grainDensity) * 10;
  // Worley edgeNoise is small (≈0) at Voronoi cell boundaries and grows toward
  // cell interiors. Fiber intersections in Xuan paper correspond to those
  // boundaries, so we accept candidates where the edge value is below a
  // threshold that relaxes with grainDensity.
  const edgeThreshold = 0.12 + options.grainDensity * 0.18;

  for (let index = 0; index < count; index++) {
    const x = rng.next() * options.width;
    const y = rng.next() * options.height;
    const edge = worley.edgeNoise2D(x, y, { cellSize });
    if (edge > edgeThreshold) {
      continue;
    }

    const fragment = rng.next() < 0.06 + options.grainDensity * 0.05;
    const rx = fragment ? 1.6 + rng.next() * 4.2 : 0.35 + rng.next() * 1.2;
    const ry = fragment ? 0.5 + rng.next() * 1.6 : rx;
    const lift = fragment ? -42 : rng.next() < 0.58 ? -58 : 18;
    const color = adjustColor(options.baseColor, [
      lift + profile.warmth * 16,
      lift - 4 + profile.warmth * 10,
      lift - 8,
    ]);

    particles.push({
      x,
      y,
      rx,
      ry,
      rotation: rng.next() * 180,
      color,
      alpha: (fragment ? 0.08 : 0.05) + (rng.next() * 0.12) / profile.grainSoftness,
    });
  }

  return particles;
}

// ---------------------------------------------------------------------------
// gold flecks (unchanged)
// ---------------------------------------------------------------------------

interface GoldCluster {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  angle: number;
  sizeBias: number;
  toneBias: number;
}

interface AcceptedGoldFleck {
  x: number;
  y: number;
  size: number;
}

function buildGoldCommands(x: number, y: number, size: number, rng: PRNG): GoldPathCommand[] {
  const commands: GoldPathCommand[] = [];
  const points: PaperPoint[] = [];
  const pointCount = 5 + Math.floor(rng.next() * 7);
  const angleWeights = Array.from({ length: pointCount }, () => 0.4 + rng.next());
  const totalWeight = angleWeights.reduce((sum, value) => sum + value, 0);
  let angle = rng.next() * Math.PI * 2;

  for (let index = 0; index < pointCount; index++) {
    angle += (angleWeights[index]! / totalWeight) * Math.PI * 2;
    const radius = size * (0.34 + rng.next() * 0.9);
    const tangentJitter = (rng.next() - 0.5) * size * 0.45;
    const radialJitter = (rng.next() - 0.5) * size * 0.22;
    points.push({
      x:
        x +
        Math.cos(angle) * (radius + radialJitter) +
        Math.cos(angle + Math.PI / 2) * tangentJitter,
      y:
        y +
        Math.sin(angle) * (radius + radialJitter) +
        Math.sin(angle + Math.PI / 2) * tangentJitter,
    });
  }

  const firstPoint = points[0];
  if (!firstPoint) {
    return [{ type: "Z" }];
  }

  commands.push({ type: "M", x: firstPoint.x, y: firstPoint.y });

  for (let index = 1; index < points.length; index++) {
    const previousPoint = points[index - 1]!;
    const point = points[index]!;
    if (rng.next() < 0.35) {
      commands.push({
        type: "Q",
        cpx: (previousPoint.x + point.x) / 2 + (rng.next() - 0.5) * size * 0.24,
        cpy: (previousPoint.y + point.y) / 2 + (rng.next() - 0.5) * size * 0.24,
        x: point.x,
        y: point.y,
      });
    } else {
      commands.push({ type: "L", x: point.x, y: point.y });
    }
  }

  commands.push({ type: "Z" });
  return commands;
}

// Dust-sized specks: 3-5 straight edges, near-round. Cheap to render because
// the Xuan paper will ship thousands of these.
function buildDustCommands(x: number, y: number, size: number, rng: PRNG): GoldPathCommand[] {
  const pointCount = 3 + Math.floor(rng.next() * 3);
  const commands: GoldPathCommand[] = [];
  const startAngle = rng.next() * TWO_PI;
  for (let i = 0; i < pointCount; i++) {
    const theta = startAngle + (i / pointCount) * TWO_PI + (rng.next() - 0.5) * 0.6;
    const radius = size * (0.65 + rng.next() * 0.55);
    const px = x + Math.cos(theta) * radius;
    const py = y + Math.sin(theta) * radius;
    commands.push(i === 0 ? { type: "M", x: px, y: py } : { type: "L", x: px, y: py });
  }
  commands.push({ type: "Z" });
  return commands;
}

function buildWrapCopies(
  x: number,
  y: number,
  width: number,
  height: number,
  margin: number,
): PaperPoint[] {
  const copies: PaperPoint[] = [{ x: 0, y: 0 }];
  const nearRight = x + margin > width;
  const nearBottom = y + margin > height;
  const nearLeft = x - margin < 0;
  const nearTop = y - margin < 0;

  if (nearRight) copies.push({ x: -width, y: 0 });
  if (nearBottom) copies.push({ x: 0, y: -height });
  if (nearLeft) copies.push({ x: width, y: 0 });
  if (nearTop) copies.push({ x: 0, y: height });
  if (nearRight && nearBottom) copies.push({ x: -width, y: -height });
  if (nearRight && nearTop) copies.push({ x: -width, y: height });
  if (nearLeft && nearBottom) copies.push({ x: width, y: -height });
  if (nearLeft && nearTop) copies.push({ x: width, y: height });

  return copies;
}

function createGoldClusters(
  options: NormalizedXuanPaperOptions,
  rng: PRNG,
  totalCount: number,
): GoldCluster[] {
  const clusterWeight = clamp(options.goldClustering * 1.15 + 0.08, 0.08, 1);
  const clusteredCount = Math.round(totalCount * (0.28 + clusterWeight * 0.5));
  if (clusteredCount <= 0) {
    return [];
  }

  const resolutionScale = Math.sqrt((options.width * options.height) / (800 * 600));
  const avgPerCluster = mix(2.4, 7.8 + Math.log2(resolutionScale + 1.5), clusterWeight);
  const clusterCount = Math.max(1, Math.round(clusteredCount / avgPerCluster));
  const nominalSpacing = Math.sqrt((options.width * options.height) / clusterCount);
  const minSide = Math.min(options.width, options.height);
  const minRadius = Math.max(options.goldSize[1] * 2.2, minSide * 0.025);
  const maxRadius = Math.max(minRadius + 1, minSide * (0.08 + clusterWeight * 0.16));

  return Array.from({ length: clusterCount }, () => {
    const radiusBase = clamp(
      nominalSpacing * (0.12 + clusterWeight * 0.14) * (0.72 + rng.next() * 0.86),
      minRadius,
      maxRadius,
    );
    const elliptic = 0.55 + rng.next() * 1.35;
    return {
      x: rng.next() * options.width,
      y: rng.next() * options.height,
      radiusX: radiusBase * elliptic,
      radiusY: radiusBase / elliptic,
      angle: rng.next() * Math.PI * 2,
      sizeBias: 0.84 + rng.next() * 0.42,
      toneBias: 0.84 + rng.next() * 0.38,
    };
  });
}

function wrapCoordinate(value: number, max: number): number {
  if (value < 0) {
    return value + max;
  }
  if (value >= max) {
    return value - max;
  }
  return value;
}

function tryAcceptGoldFleck(
  accepted: AcceptedGoldFleck[],
  x: number,
  y: number,
  size: number,
  options: NormalizedXuanPaperOptions,
  rng: PRNG,
): boolean {
  const resolutionScale = Math.sqrt((options.width * options.height) / (800 * 600));
  const lowResRelax = clamp(1.15 - resolutionScale * 0.14, 0.72, 1.15);
  const baseDistance = size * (0.8 + rng.next() * 0.45) * lowResRelax;

  for (let index = accepted.length - 1; index >= 0; index--) {
    const other = accepted[index]!;
    if (Math.abs(other.x - x) > baseDistance * 3 || Math.abs(other.y - y) > baseDistance * 3) {
      continue;
    }
    const minDistance = ((other.size + size) * 0.34 + baseDistance) * 0.5;
    if (Math.hypot(other.x - x, other.y - y) < minDistance) {
      return rng.next() < 0.12 + options.goldClustering * 0.08;
    }
  }

  return true;
}

function sampleGoldPosition(
  options: NormalizedXuanPaperOptions,
  clusters: GoldCluster[],
  useCluster: boolean,
  rng: PRNG,
): { point: PaperPoint; cluster: GoldCluster | null } {
  if (!useCluster || clusters.length === 0) {
    return {
      point: {
        x: rng.next() * options.width,
        y: rng.next() * options.height,
      },
      cluster: null,
    };
  }

  const cluster = clusters[Math.floor(rng.next() * clusters.length)]!;
  const theta = rng.next() * Math.PI * 2;
  const radial = Math.pow(rng.next(), 0.52 + rng.next() * 0.36);
  const localX = Math.cos(theta) * cluster.radiusX * radial;
  const localY = Math.sin(theta) * cluster.radiusY * radial;
  const streak = (rng.next() - 0.5) * Math.max(cluster.radiusX, cluster.radiusY) * 0.18;

  const rotatedX =
    localX * Math.cos(cluster.angle) -
    localY * Math.sin(cluster.angle) +
    Math.cos(cluster.angle + Math.PI / 2) * streak;
  const rotatedY =
    localX * Math.sin(cluster.angle) +
    localY * Math.cos(cluster.angle) +
    Math.sin(cluster.angle + Math.PI / 2) * streak;

  return {
    point: {
      x: wrapCoordinate(cluster.x + rotatedX, options.width),
      y: wrapCoordinate(cluster.y + rotatedY, options.height),
    },
    cluster,
  };
}

function generateGoldFlecks(
  options: NormalizedXuanPaperOptions,
  profile: XuanPaperProfile,
): GoldFleck[] {
  if (!options.goldFlecks || options.goldDensity <= 0) {
    return [];
  }

  const rng = new PRNG();
  rng.seed(options.seed + SEED_OFFSETS.gold);

  const area = options.width * options.height;
  const resolutionScale = Math.sqrt(area / (800 * 600));
  const lowResBoost = clamp(1.18 - resolutionScale * 0.18, 1, 1.18);

  // Real sprinkled-gold Xuan paper carries thousands of particles per sheet,
  // dominated by tiny dust. Total count scales linearly with area.
  const totalCount = Math.max(
    Math.round(80 * options.goldDensity),
    Math.floor(area * options.goldDensity * 0.003 * lowResBoost),
  );

  const minSize = options.goldSize[0];
  const maxSize = options.goldSize[1];
  const wrapMargin = maxSize * 2.2;
  const flecks: GoldFleck[] = [];
  const bigAccepted: AcceptedGoldFleck[] = [];
  const clusters = createGoldClusters(options, rng, totalCount);
  const clusterWeight = clamp(options.goldClustering * 1.15 + 0.08, 0.08, 1);
  // Lean hard toward "isolated" (uniform scatter); clusters only bend local
  // density, they do not form tight groups.
  const isolatedRatio = clamp(0.9 - clusterWeight * 0.35, 0.55, 0.9);
  const lowResSizeBoost = clamp(1.18 - resolutionScale * 0.12, 1, 1.18);

  // Threshold above which a particle is treated as a "flake" (irregular
  // polygon + rejection sampling + potential satellite halo). Everything below
  // is dust (simple polygon, no rejection).
  const flakeSizeThreshold = minSize + (maxSize - minSize) * 0.18;

  const skipRejection = options.goldDistribution === "random";

  // Pre-roll sizes from a dedicated stream so rejection retries on positions
  // do not shift the size distribution between "poisson" and "random" modes.
  // Pareto-like skew (u^4.2) lands ~8% above the flake threshold at default
  // [2, 12] sizing.
  const sizeRng = new PRNG();
  sizeRng.seed(options.seed + SEED_OFFSETS.gold + 20001);
  const preSizes: Array<{ size: number; isFlake: boolean }> = [];
  for (let i = 0; i < totalCount; i++) {
    const sizeRatio = Math.pow(sizeRng.next(), 4.2);
    const raw = mix(minSize, maxSize, sizeRatio) * lowResSizeBoost * (0.82 + sizeRng.next() * 0.32);
    preSizes.push({ size: raw, isFlake: raw >= flakeSizeThreshold });
  }

  for (let index = 0; index < totalCount; index++) {
    const { size: targetSize, isFlake } = preSizes[index]!;

    let attempts = 0;
    let x = 0;
    let y = 0;
    let clusterToneBias = 1;
    let clusterSizeBias = 1;
    let accepted = false;

    const maxAttempts = isFlake && !skipRejection ? 8 : 1;

    while (attempts < maxAttempts) {
      const useCluster = clusters.length > 0 && rng.next() > isolatedRatio;
      const sampled = sampleGoldPosition(options, clusters, useCluster, rng);
      x = sampled.point.x;
      y = sampled.point.y;

      if (useCluster && sampled.cluster) {
        clusterToneBias = sampled.cluster.toneBias;
        clusterSizeBias = sampled.cluster.sizeBias;
      } else {
        clusterToneBias = 0.92 + rng.next() * 0.2;
        clusterSizeBias = 0.94 + rng.next() * 0.12;
      }

      if (!isFlake || skipRejection) {
        accepted = true;
        break;
      }
      if (tryAcceptGoldFleck(bigAccepted, x, y, targetSize, options, rng)) {
        accepted = true;
        break;
      }
      attempts++;
    }
    if (!accepted) continue;

    const size = targetSize * clusterSizeBias;
    if (isFlake) {
      bigAccepted.push({ x, y, size });
    }

    const brightness =
      (0.78 + rng.next() * 0.32) * clusterToneBias * (0.94 + profile.formationContrast * 0.08);
    const boost = rng.next() < 0.16 ? 1.18 : 1;
    const color: [number, number, number] = [
      clamp(round(options.goldColor[0] * brightness * boost), 0, 255),
      clamp(round(options.goldColor[1] * brightness * boost), 0, 255),
      clamp(round(options.goldColor[2] * brightness * boost * 0.92), 0, 255),
    ];

    const localRng = new PRNG();
    localRng.seed(options.seed + SEED_OFFSETS.gold + index * 7);
    const commands = isFlake
      ? buildGoldCommands(x, y, size, localRng)
      : buildDustCommands(x, y, size, localRng);

    flecks.push({
      commands,
      copies: buildWrapCopies(x, y, options.width, options.height, wrapMargin),
      color,
      alpha: isFlake ? 0.82 + rng.next() * 0.16 : 0.68 + rng.next() * 0.22,
    });
  }

  // Satellite halos: tiny specks scattered around each large flake to suggest
  // the splatter pattern of cracked gold leaf. Seeded independently so this
  // extra consumption does not shift the dust population when clustering or
  // rejection behavior changes.
  const satelliteRng = new PRNG();
  satelliteRng.seed(options.seed + SEED_OFFSETS.gold + 70001);
  for (let i = 0; i < bigAccepted.length; i++) {
    const big = bigAccepted[i]!;
    if (big.size < flakeSizeThreshold * 1.6) continue;
    const satCount = 2 + Math.floor(satelliteRng.next() * 4);
    for (let s = 0; s < satCount; s++) {
      const theta = satelliteRng.next() * TWO_PI;
      const dist = big.size * (1.2 + satelliteRng.next() * 2.6);
      const sx = big.x + Math.cos(theta) * dist;
      const sy = big.y + Math.sin(theta) * dist;
      const ssize = 0.45 + satelliteRng.next() * 0.95;

      const brightness = 0.78 + satelliteRng.next() * 0.22;
      const satColor: [number, number, number] = [
        clamp(round(options.goldColor[0] * brightness), 0, 255),
        clamp(round(options.goldColor[1] * brightness), 0, 255),
        clamp(round(options.goldColor[2] * brightness * 0.92), 0, 255),
      ];

      const satRng = new PRNG();
      satRng.seed(options.seed + SEED_OFFSETS.gold + 70001 + i * 29 + s * 13);
      flecks.push({
        commands: buildDustCommands(sx, sy, ssize, satRng),
        copies: buildWrapCopies(sx, sy, options.width, options.height, wrapMargin),
        color: satColor,
        alpha: 0.6 + satelliteRng.next() * 0.25,
      });
    }
  }

  return flecks;
}

// ---------------------------------------------------------------------------
// deckle edge: midpoint-displacement fBm
// ---------------------------------------------------------------------------

function midpointDisplacementProfile(
  length: number,
  baseInset: number,
  roughness: number,
  hurst: number,
  rng: PRNG,
): number[] {
  let size = 1;
  while (size < length) size *= 2;

  const arr: number[] = Array.from({ length: size + 1 }, () => 0);
  const endpointJitter = () => baseInset * (0.6 + rng.next() * 0.7);
  arr[0] = endpointJitter();
  arr[size] = endpointJitter();

  let stride = size;
  let sigma = baseInset * roughness;
  const decay = Math.pow(2, -hurst);

  while (stride > 1) {
    const half = stride / 2;
    for (let i = half; i < size; i += stride) {
      const avg = (arr[i - half]! + arr[i + half]!) / 2;
      arr[i] = Math.max(0, avg + gaussianSample(rng) * sigma);
    }
    stride = half;
    sigma *= decay;
  }

  if (size > length) {
    arr.length = length + 1;
  }
  return arr;
}

function buildDeckleOutline(
  options: NormalizedXuanPaperOptions,
  profile: XuanPaperProfile,
): DeckleOutline | null {
  if (!options.deckleEdge) {
    return null;
  }

  const rng = new PRNG();
  rng.seed(options.seed + SEED_OFFSETS.deckle);

  const baseInset = (12 + options.deckleRoughness * 20) * profile.deckleSoftness;
  // Higher roughness knob → lower Hurst → edge tears appear more fractal.
  const hurst = clamp(0.85 - options.deckleRoughness * 0.35, 0.4, 0.9);
  const roughness = 0.35 + options.deckleRoughness * 0.55;

  return {
    top: midpointDisplacementProfile(options.width, baseInset, roughness, hurst, rng),
    bottom: midpointDisplacementProfile(options.width, baseInset, roughness, hurst, rng),
    left: midpointDisplacementProfile(options.height, baseInset, roughness, hurst, rng),
    right: midpointDisplacementProfile(options.height, baseInset, roughness, hurst, rng),
  };
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

const SCENE_CACHE_LIMIT = 8;
const sceneCache = new Map<string, XuanPaperScene>();

function sceneCacheKey(options: NormalizedXuanPaperOptions): string {
  return [
    options.width,
    options.height,
    options.baseColor.join(","),
    options.fiberDensity,
    options.fiberScale,
    options.textureIntensity,
    options.grainDensity,
    options.age,
    options.deckleEdge ? 1 : 0,
    options.deckleRoughness,
    options.seed,
    options.mode,
    options.goldFlecks ? 1 : 0,
    options.goldDensity,
    options.goldSize.join(","),
    options.goldColor.join(","),
    options.goldClustering,
    options.goldDistribution,
  ].join("|");
}

function clonePoint(point: PaperPoint): PaperPoint {
  return { x: point.x, y: point.y };
}

function cloneColor(color: [number, number, number]): [number, number, number] {
  return [color[0], color[1], color[2]];
}

function cloneGoldCommand(command: GoldPathCommand): GoldPathCommand {
  switch (command.type) {
    case "M":
      return { type: "M", x: command.x, y: command.y };
    case "L":
      return { type: "L", x: command.x, y: command.y };
    case "Q":
      return { type: "Q", cpx: command.cpx, cpy: command.cpy, x: command.x, y: command.y };
    case "Z":
      return { type: "Z" };
  }
}

function cloneScene(scene: XuanPaperScene): XuanPaperScene {
  return {
    options: {
      ...scene.options,
      baseColor: cloneColor(scene.options.baseColor),
      goldSize: [scene.options.goldSize[0], scene.options.goldSize[1]],
      goldColor: cloneColor(scene.options.goldColor),
    },
    profile: { ...scene.profile },
    seeds: { ...scene.seeds },
    fibers: scene.fibers.map((fiber) => ({
      points: fiber.points.map(clonePoint),
      width: fiber.width,
      color: cloneColor(fiber.color),
      alpha: fiber.alpha,
    })),
    particles: scene.particles.map((particle) => ({
      x: particle.x,
      y: particle.y,
      rx: particle.rx,
      ry: particle.ry,
      rotation: particle.rotation,
      color: cloneColor(particle.color),
      alpha: particle.alpha,
    })),
    goldFlecks: scene.goldFlecks.map((fleck) => ({
      commands: fleck.commands.map(cloneGoldCommand),
      copies: fleck.copies.map(clonePoint),
      color: cloneColor(fleck.color),
      alpha: fleck.alpha,
    })),
    deckleOutline: scene.deckleOutline
      ? {
          top: scene.deckleOutline.top.slice(),
          right: scene.deckleOutline.right.slice(),
          bottom: scene.deckleOutline.bottom.slice(),
          left: scene.deckleOutline.left.slice(),
        }
      : null,
  };
}

function rememberScene(key: string, scene: XuanPaperScene): void {
  sceneCache.set(key, cloneScene(scene));
  if (sceneCache.size > SCENE_CACHE_LIMIT) {
    const oldestKey = sceneCache.keys().next().value;
    if (oldestKey !== undefined) {
      sceneCache.delete(oldestKey);
    }
  }
}

export function buildXuanPaperScene(options: XuanPaperOptions = {}): XuanPaperScene {
  const normalized = normalizeXuanPaperOptions(options);
  const profile = buildXuanPaperProfile(normalized);
  const cacheKey = sceneCacheKey(normalized);
  const cached = sceneCache.get(cacheKey);
  if (cached) {
    sceneCache.delete(cacheKey);
    sceneCache.set(cacheKey, cached);
    return cloneScene(cached);
  }

  const scene: XuanPaperScene = {
    options: normalized,
    profile,
    seeds: {
      tone: normalized.seed + SEED_OFFSETS.tone,
      formation: normalized.seed + SEED_OFFSETS.formation,
      detail: normalized.seed + SEED_OFFSETS.detail,
      fibers: normalized.seed + SEED_OFFSETS.fibers,
      particles: normalized.seed + SEED_OFFSETS.particles,
      aging: normalized.seed + SEED_OFFSETS.aging,
      gold: normalized.seed + SEED_OFFSETS.gold,
      deckle: normalized.seed + SEED_OFFSETS.deckle,
    },
    fibers: generateFibers(normalized, profile),
    particles: generateParticles(normalized, profile),
    goldFlecks: generateGoldFlecks(normalized, profile),
    deckleOutline: buildDeckleOutline(normalized, profile),
  };

  rememberScene(cacheKey, scene);
  return scene;
}
