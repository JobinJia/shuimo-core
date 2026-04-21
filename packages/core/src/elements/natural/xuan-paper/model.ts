import { PerlinNoise } from "../../../foundation/noise";
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

function createNoise(seed: number, octaves: number = 4, falloff: number = 0.5): PerlinNoise {
  const noise = new PerlinNoise();
  noise.noiseSeed(seed);
  noise.noiseDetail(octaves, falloff);
  return noise;
}

function createStroke(
  width: number,
  height: number,
  seed: number,
  rng: PRNG,
  scale: number,
  profile: XuanPaperProfile,
  baseColor: [number, number, number],
  fragment: boolean,
): FiberStroke {
  const directionNoise = createNoise(seed);
  const curlNoise = createNoise(seed + 19);
  const startX = rng.next() * width;
  const startY = rng.next() * height;
  const points: PaperPoint[] = [{ x: startX, y: startY }];

  const baseLength = fragment ? 28 + rng.next() * 54 : 85 + rng.next() * 160;
  const segments = fragment ? 7 + Math.floor(rng.next() * 7) : 15 + Math.floor(rng.next() * 15);
  const strokeLength = baseLength * scale * profile.fiberLengthMultiplier;
  const segmentLength = strokeLength / segments;

  let x = startX;
  let y = startY;
  let angle = directionNoise.noise(startX * 0.005, startY * 0.005) * Math.PI * 2;

  for (let index = 0; index < segments; index++) {
    const curl =
      (curlNoise.noise(x * 0.008 + index * 0.1, y * 0.008) - 0.5) * (fragment ? 0.48 : 0.34);
    angle += curl;
    x += Math.cos(angle) * segmentLength;
    y += Math.sin(angle) * segmentLength;
    points.push({ x, y });
  }

  const darkness = fragment ? 60 : 46;
  const warmthLift = profile.warmth * 18;
  const color = adjustColor(baseColor, [
    -(darkness - warmthLift),
    -(darkness + 5 - warmthLift * 0.6),
    -(darkness + 14),
  ]);

  return {
    points,
    width: (fragment ? 0.35 : 0.28) + rng.next() * (fragment ? 0.55 : 0.42),
    color,
    alpha: (fragment ? 0.08 : 0.05) + rng.next() * 0.08 * profile.fiberContrast,
  };
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
  const fibers: FiberStroke[] = [];

  for (let index = 0; index < mainCount; index++) {
    fibers.push(
      createStroke(
        options.width,
        options.height,
        options.seed + SEED_OFFSETS.fibers + index * 7,
        rng,
        options.fiberScale,
        profile,
        options.baseColor,
        false,
      ),
    );
  }

  for (let index = 0; index < fragmentCount; index++) {
    fibers.push(
      createStroke(
        options.width,
        options.height,
        options.seed + SEED_OFFSETS.fibers + 5000 + index * 11,
        rng,
        options.fiberScale,
        profile,
        options.baseColor,
        true,
      ),
    );
  }

  return fibers;
}

function generateParticles(
  options: NormalizedXuanPaperOptions,
  profile: XuanPaperProfile,
): GrainParticle[] {
  const rng = new PRNG();
  rng.seed(options.seed + SEED_OFFSETS.particles);

  const densityNoise = createNoise(options.seed + SEED_OFFSETS.particles + 37);
  const area = options.width * options.height;
  const count = Math.floor(area * options.grainDensity * 0.0016 * profile.particleContrast);
  const particles: GrainParticle[] = [];

  for (let index = 0; index < count; index++) {
    const x = rng.next() * options.width;
    const y = rng.next() * options.height;
    const weight = densityNoise.noise(x * 0.01, y * 0.01);
    if (weight < 0.28) {
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
  const count = Math.max(
    Math.round(8 * options.goldDensity),
    Math.floor(area * options.goldDensity * 0.00055 * lowResBoost),
  );
  const maxSize = options.goldSize[1];
  const wrapMargin = maxSize * 1.6;
  const flecks: GoldFleck[] = [];
  const accepted: AcceptedGoldFleck[] = [];
  const clusters = createGoldClusters(options, rng, count);
  const clusterWeight = clamp(options.goldClustering * 1.15 + 0.08, 0.08, 1);
  const isolatedRatio = clamp(0.72 - clusterWeight * 0.5, 0.2, 0.72);
  const lowResSizeBoost = clamp(1.18 - resolutionScale * 0.12, 1, 1.18);

  for (let index = 0; index < count; index++) {
    let attempts = 0;
    let x = 0;
    let y = 0;
    let size = options.goldSize[0];
    let clusterToneBias = 1;
    let clusterSizeBias = 1;

    while (attempts < 18) {
      const useCluster = clusters.length > 0 && rng.next() > isolatedRatio;
      const sampled = sampleGoldPosition(options, clusters, useCluster, rng);
      x = sampled.point.x;
      y = sampled.point.y;

      if (useCluster && sampled.cluster) {
        const cluster = sampled.cluster;
        clusterToneBias = cluster.toneBias;
        clusterSizeBias = cluster.sizeBias;
      } else {
        clusterToneBias = 0.92 + rng.next() * 0.2;
        clusterSizeBias = 0.9 + rng.next() * 0.18;
      }

      size =
        mix(options.goldSize[0], options.goldSize[1], Math.pow(rng.next(), 0.66)) *
        clusterSizeBias *
        lowResSizeBoost *
        (0.84 + rng.next() * 0.26);

      if (tryAcceptGoldFleck(accepted, x, y, size, options, rng)) {
        accepted.push({ x, y, size });
        break;
      }

      attempts++;
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
    const commands = buildGoldCommands(x, y, size, localRng);

    const copies: PaperPoint[] = [{ x: 0, y: 0 }];
    const nearRight = x + wrapMargin > options.width;
    const nearBottom = y + wrapMargin > options.height;
    const nearLeft = x - wrapMargin < 0;
    const nearTop = y - wrapMargin < 0;

    if (nearRight) copies.push({ x: -options.width, y: 0 });
    if (nearBottom) copies.push({ x: 0, y: -options.height });
    if (nearLeft) copies.push({ x: options.width, y: 0 });
    if (nearTop) copies.push({ x: 0, y: options.height });
    if (nearRight && nearBottom) copies.push({ x: -options.width, y: -options.height });
    if (nearRight && nearTop) copies.push({ x: -options.width, y: options.height });
    if (nearLeft && nearBottom) copies.push({ x: options.width, y: -options.height });
    if (nearLeft && nearTop) copies.push({ x: options.width, y: options.height });

    flecks.push({
      commands,
      copies,
      color,
      alpha: 0.82 + rng.next() * 0.16,
    });
  }

  return flecks;
}

function buildDeckleOutline(
  options: NormalizedXuanPaperOptions,
  profile: XuanPaperProfile,
): DeckleOutline | null {
  if (!options.deckleEdge) {
    return null;
  }

  const topNoise = createNoise(options.seed + SEED_OFFSETS.deckle + 11);
  const sideNoise = createNoise(options.seed + SEED_OFFSETS.deckle + 23);
  const maxInset = (12 + options.deckleRoughness * 20) * profile.deckleSoftness;
  const top: number[] = [];
  const right: number[] = [];
  const bottom: number[] = [];
  const left: number[] = [];

  for (let x = 0; x <= options.width; x++) {
    const topNoiseValue = topNoise.noise(x * 0.05, 0);
    const bottomNoiseValue = topNoise.noise(x * 0.05, 100);
    top.push(maxInset * (0.24 + topNoiseValue * options.deckleRoughness));
    bottom.push(maxInset * (0.24 + bottomNoiseValue * options.deckleRoughness));
  }

  for (let y = 0; y <= options.height; y++) {
    const leftNoiseValue = sideNoise.noise(0, y * 0.05);
    const rightNoiseValue = sideNoise.noise(100, y * 0.05);
    left.push(maxInset * (0.24 + leftNoiseValue * options.deckleRoughness));
    right.push(maxInset * (0.24 + rightNoiseValue * options.deckleRoughness));
  }

  return { top, right, bottom, left };
}

export function buildXuanPaperScene(options: XuanPaperOptions = {}): XuanPaperScene {
  const normalized = normalizeXuanPaperOptions(options);
  const profile = buildXuanPaperProfile(normalized);

  return {
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
}
