import type { DeckleOutline, FiberStroke, GoldPathCommand, XuanPaperScene } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function adjustColor(
  color: [number, number, number],
  deltas: [number, number, number],
): [number, number, number] {
  return [
    clamp(Math.round(color[0] + deltas[0]), 0, 255),
    clamp(Math.round(color[1] + deltas[1]), 0, 255),
    clamp(Math.round(color[2] + deltas[2]), 0, 255),
  ];
}

function rgb(color: [number, number, number]): string {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function rgba(color: [number, number, number], alpha: number): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function commandToString(command: GoldPathCommand, offsetX: number, offsetY: number): string {
  switch (command.type) {
    case "M":
      return `M ${command.x + offsetX} ${command.y + offsetY}`;
    case "L":
      return `L ${command.x + offsetX} ${command.y + offsetY}`;
    case "Q":
      return `Q ${command.cpx + offsetX} ${command.cpy + offsetY} ${command.x + offsetX} ${command.y + offsetY}`;
    case "Z":
      return "Z";
  }
}

function buildFiberPath(stroke: FiberStroke): string {
  const firstPoint = stroke.points[0];
  if (!firstPoint) {
    return "";
  }

  const parts: string[] = [`M ${firstPoint.x} ${firstPoint.y}`];
  for (let index = 1; index < stroke.points.length; index++) {
    const point = stroke.points[index]!;
    parts.push(`L ${point.x} ${point.y}`);
  }
  return parts.join(" ");
}

function sampleList(values: number[], index: number): number {
  return values[Math.max(0, Math.min(values.length - 1, index))] ?? 0;
}

function buildOutlinePathData(
  outline: DeckleOutline | null,
  width: number,
  height: number,
): string {
  if (!outline) {
    return `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;
  }

  const step = Math.max(1, Math.floor(Math.max(width, height) / 800));
  const segments: string[] = [];

  segments.push(`M 0 ${sampleList(outline.top, 0)}`);

  for (let x = step; x <= width; x += step) {
    segments.push(`L ${x} ${sampleList(outline.top, x)}`);
  }
  if (width % step !== 0) {
    segments.push(`L ${width} ${sampleList(outline.top, width)}`);
  }

  for (let y = step; y <= height; y += step) {
    segments.push(`L ${width - sampleList(outline.right, y)} ${y}`);
  }
  if (height % step !== 0) {
    segments.push(`L ${width - sampleList(outline.right, height)} ${height}`);
  }

  for (let x = width - step; x >= 0; x -= step) {
    segments.push(`L ${x} ${height - sampleList(outline.bottom, x)}`);
  }
  if (width % step !== 0) {
    segments.push(`L 0 ${height - sampleList(outline.bottom, 0)}`);
  }

  for (let y = height - step; y >= 0; y -= step) {
    segments.push(`L ${sampleList(outline.left, y)} ${y}`);
  }

  segments.push("Z");
  return segments.join(" ");
}

function appendTextureFilter(defs: SVGDefsElement, id: string, scene: XuanPaperScene): void {
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", id);
  filter.setAttribute("x", "0%");
  filter.setAttribute("y", "0%");
  filter.setAttribute("width", "100%");
  filter.setAttribute("height", "100%");

  const turbulence = document.createElementNS(SVG_NS, "feTurbulence");
  turbulence.setAttribute("type", "fractalNoise");
  turbulence.setAttribute(
    "baseFrequency",
    `${0.018 / scene.profile.grainSoftness} ${0.045 / scene.profile.grainSoftness}`,
  );
  turbulence.setAttribute("numOctaves", "4");
  turbulence.setAttribute("seed", String(scene.seeds.formation));
  turbulence.setAttribute("result", "grain");
  filter.appendChild(turbulence);

  const displacement = document.createElementNS(SVG_NS, "feDisplacementMap");
  displacement.setAttribute("in", "SourceGraphic");
  displacement.setAttribute("in2", "grain");
  displacement.setAttribute("scale", String(0.5 + scene.options.textureIntensity * 2.2));
  displacement.setAttribute("xChannelSelector", "R");
  displacement.setAttribute("yChannelSelector", "G");
  displacement.setAttribute("result", "paper");
  filter.appendChild(displacement);

  const blur = document.createElementNS(SVG_NS, "feGaussianBlur");
  blur.setAttribute("in", "grain");
  blur.setAttribute("stdDeviation", String(0.2 + scene.options.textureIntensity * 0.55));
  blur.setAttribute("result", "softGrain");
  filter.appendChild(blur);

  const blend = document.createElementNS(SVG_NS, "feBlend");
  blend.setAttribute("in", "paper");
  blend.setAttribute("in2", "softGrain");
  blend.setAttribute("mode", "multiply");
  filter.appendChild(blend);

  defs.appendChild(filter);
}

function appendAgingFilter(defs: SVGDefsElement, id: string, scene: XuanPaperScene): void {
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", id);

  const turbulence = document.createElementNS(SVG_NS, "feTurbulence");
  turbulence.setAttribute("type", "fractalNoise");
  turbulence.setAttribute("baseFrequency", "0.015 0.03");
  turbulence.setAttribute("numOctaves", "3");
  turbulence.setAttribute("seed", String(scene.seeds.aging));
  turbulence.setAttribute("result", "agingNoise");
  filter.appendChild(turbulence);

  const blur = document.createElementNS(SVG_NS, "feGaussianBlur");
  blur.setAttribute("in", "agingNoise");
  blur.setAttribute("stdDeviation", "0.6");
  blur.setAttribute("result", "agingBlur");
  filter.appendChild(blur);

  defs.appendChild(filter);
}

function appendPaperLayers(
  svg: SVGSVGElement,
  scene: XuanPaperScene,
  outlinePath: string,
  clipPathId: string,
  textureFilterId: string,
  agingFilterId: string,
): void {
  const basePath = document.createElementNS(SVG_NS, "path");
  basePath.setAttribute("d", outlinePath);
  basePath.setAttribute("fill", rgb(scene.options.baseColor));
  svg.appendChild(basePath);

  const toneOverlay = document.createElementNS(SVG_NS, "path");
  toneOverlay.setAttribute("d", outlinePath);
  toneOverlay.setAttribute("fill", rgb(adjustColor(scene.options.baseColor, [20, 16, 4])));
  toneOverlay.setAttribute("filter", `url(#${textureFilterId})`);
  toneOverlay.setAttribute("opacity", String(0.04 + scene.options.textureIntensity * 0.12));
  toneOverlay.setAttribute("clip-path", `url(#${clipPathId})`);
  svg.appendChild(toneOverlay);

  const formationOverlay = document.createElementNS(SVG_NS, "path");
  formationOverlay.setAttribute("d", outlinePath);
  formationOverlay.setAttribute("fill", rgb(adjustColor(scene.options.baseColor, [-18, -16, -12])));
  formationOverlay.setAttribute("filter", `url(#${textureFilterId})`);
  formationOverlay.setAttribute("opacity", String(0.05 + scene.profile.formationContrast * 0.08));
  formationOverlay.setAttribute("clip-path", `url(#${clipPathId})`);
  svg.appendChild(formationOverlay);

  if (scene.options.age > 0) {
    const agingOverlay = document.createElementNS(SVG_NS, "path");
    agingOverlay.setAttribute("d", outlinePath);
    agingOverlay.setAttribute("fill", rgb(adjustColor(scene.options.baseColor, [18, 10, -22])));
    agingOverlay.setAttribute("filter", `url(#${agingFilterId})`);
    agingOverlay.setAttribute(
      "opacity",
      String(scene.options.age * 0.22 * scene.profile.patinaStrength),
    );
    agingOverlay.setAttribute("clip-path", `url(#${clipPathId})`);
    svg.appendChild(agingOverlay);
  }
}

function appendFiberLayer(svg: SVGSVGElement, scene: XuanPaperScene, clipPathId: string): void {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("data-layer", "fibers");
  group.setAttribute("clip-path", `url(#${clipPathId})`);

  for (const fiber of scene.fibers) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", buildFiberPath(fiber));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", rgba(fiber.color, fiber.alpha));
    path.setAttribute("stroke-width", String(fiber.width));
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    group.appendChild(path);
  }

  svg.appendChild(group);
}

function appendParticleLayer(svg: SVGSVGElement, scene: XuanPaperScene, clipPathId: string): void {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("data-layer", "particles");
  group.setAttribute("clip-path", `url(#${clipPathId})`);

  for (const particle of scene.particles) {
    const ellipse = document.createElementNS(SVG_NS, "ellipse");
    ellipse.setAttribute("cx", String(particle.x));
    ellipse.setAttribute("cy", String(particle.y));
    ellipse.setAttribute("rx", String(particle.rx));
    ellipse.setAttribute("ry", String(particle.ry));
    ellipse.setAttribute("transform", `rotate(${particle.rotation} ${particle.x} ${particle.y})`);
    ellipse.setAttribute("fill", rgba(particle.color, particle.alpha));
    group.appendChild(ellipse);
  }

  svg.appendChild(group);
}

function appendGoldLayer(svg: SVGSVGElement, scene: XuanPaperScene, clipPathId: string): void {
  if (!scene.options.goldFlecks) {
    return;
  }

  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("data-layer", "gold-flecks");
  group.setAttribute("clip-path", `url(#${clipPathId})`);

  for (const fleck of scene.goldFlecks) {
    for (const copy of fleck.copies) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute(
        "d",
        fleck.commands.map((command) => commandToString(command, copy.x, copy.y)).join(" "),
      );
      path.setAttribute("fill", rgba(fleck.color, fleck.alpha));
      group.appendChild(path);
    }
  }

  svg.appendChild(group);
}

function appendDeckleStroke(svg: SVGSVGElement, scene: XuanPaperScene, outlinePath: string): void {
  if (!scene.deckleOutline) {
    return;
  }

  const edgeStroke = document.createElementNS(SVG_NS, "path");
  edgeStroke.setAttribute("d", outlinePath);
  edgeStroke.setAttribute("fill", "none");
  edgeStroke.setAttribute(
    "stroke",
    rgba(adjustColor(scene.options.baseColor, [-35, -30, -22]), 0.16),
  );
  edgeStroke.setAttribute("stroke-width", String(0.8 + scene.options.deckleRoughness * 0.8));
  svg.appendChild(edgeStroke);
}

export interface XuanPaperSVGParts {
  defs: string;
  body: string;
}

function buildTextureFilterString(id: string, scene: XuanPaperScene): string {
  return `<filter id="${id}" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${0.018 / scene.profile.grainSoftness} ${0.045 / scene.profile.grainSoftness}" numOctaves="4" seed="${scene.seeds.formation}" result="grain"/>
    <feDisplacementMap in="SourceGraphic" in2="grain" scale="${0.5 + scene.options.textureIntensity * 2.2}" xChannelSelector="R" yChannelSelector="G" result="paper"/>
    <feGaussianBlur in="grain" stdDeviation="${0.2 + scene.options.textureIntensity * 0.55}" result="softGrain"/>
    <feBlend in="paper" in2="softGrain" mode="multiply"/>
  </filter>`;
}

function buildAgingFilterString(id: string, scene: XuanPaperScene): string {
  return `<filter id="${id}">
    <feTurbulence type="fractalNoise" baseFrequency="0.015 0.03" numOctaves="3" seed="${scene.seeds.aging}" result="agingNoise"/>
    <feGaussianBlur in="agingNoise" stdDeviation="0.6" result="agingBlur"/>
  </filter>`;
}

function buildPaperLayersString(
  scene: XuanPaperScene,
  outlinePath: string,
  clipPathId: string,
  textureFilterId: string,
  agingFilterId: string,
): string {
  let body = `<path d="${outlinePath}" fill="${rgb(scene.options.baseColor)}"/>`;
  body += `<path d="${outlinePath}" fill="${rgb(adjustColor(scene.options.baseColor, [20, 16, 4]))}" filter="url(#${textureFilterId})" opacity="${0.04 + scene.options.textureIntensity * 0.12}" clip-path="url(#${clipPathId})"/>`;
  body += `<path d="${outlinePath}" fill="${rgb(adjustColor(scene.options.baseColor, [-18, -16, -12]))}" filter="url(#${textureFilterId})" opacity="${0.05 + scene.profile.formationContrast * 0.08}" clip-path="url(#${clipPathId})"/>`;

  if (scene.options.age > 0) {
    body += `<path d="${outlinePath}" fill="${rgb(adjustColor(scene.options.baseColor, [18, 10, -22]))}" filter="url(#${agingFilterId})" opacity="${scene.options.age * 0.22 * scene.profile.patinaStrength}" clip-path="url(#${clipPathId})"/>`;
  }

  return body;
}

function buildFiberLayerString(scene: XuanPaperScene, clipPathId: string): string {
  if (scene.fibers.length === 0) {
    return "";
  }

  const paths: string[] = [];
  for (const fiber of scene.fibers) {
    const d = buildFiberPath(fiber);
    if (!d) continue;
    paths.push(
      `<path d="${d}" fill="none" stroke="${rgba(fiber.color, fiber.alpha)}" stroke-width="${fiber.width}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }

  return `<g data-layer="fibers" clip-path="url(#${clipPathId})">${paths.join("")}</g>`;
}

function buildParticleLayerString(scene: XuanPaperScene, clipPathId: string): string {
  if (scene.particles.length === 0) {
    return "";
  }

  const particles: string[] = [];
  for (const particle of scene.particles) {
    particles.push(
      `<ellipse cx="${particle.x}" cy="${particle.y}" rx="${particle.rx}" ry="${particle.ry}" transform="rotate(${particle.rotation} ${particle.x} ${particle.y})" fill="${rgba(particle.color, particle.alpha)}"/>`,
    );
  }

  return `<g data-layer="particles" clip-path="url(#${clipPathId})">${particles.join("")}</g>`;
}

function buildGoldLayerString(scene: XuanPaperScene, clipPathId: string): string {
  if (!scene.options.goldFlecks || scene.goldFlecks.length === 0) {
    return "";
  }

  const paths: string[] = [];
  for (const fleck of scene.goldFlecks) {
    for (const copy of fleck.copies) {
      const d = fleck.commands.map((command) => commandToString(command, copy.x, copy.y)).join(" ");
      paths.push(`<path d="${d}" fill="${rgba(fleck.color, fleck.alpha)}"/>`);
    }
  }

  return `<g data-layer="gold-flecks" clip-path="url(#${clipPathId})">${paths.join("")}</g>`;
}

function buildDeckleStrokeString(scene: XuanPaperScene, outlinePath: string): string {
  if (!scene.deckleOutline) {
    return "";
  }

  return `<path d="${outlinePath}" fill="none" stroke="${rgba(adjustColor(scene.options.baseColor, [-35, -30, -22]), 0.16)}" stroke-width="${0.8 + scene.options.deckleRoughness * 0.8}"/>`;
}

export function renderXuanPaperSVGParts(scene: XuanPaperScene): XuanPaperSVGParts {
  const textureFilterId = `xuan-paper-texture-${scene.options.seed}`;
  const agingFilterId = `xuan-paper-aging-${scene.options.seed}`;
  const clipPathId = `xuan-paper-clip-${scene.options.seed}`;
  const outlinePath = buildOutlinePathData(
    scene.deckleOutline,
    scene.options.width,
    scene.options.height,
  );

  const defs = [
    buildTextureFilterString(textureFilterId, scene),
    buildAgingFilterString(agingFilterId, scene),
    `<clipPath id="${clipPathId}"><path d="${outlinePath}"/></clipPath>`,
  ].join("");

  const body = [
    buildPaperLayersString(scene, outlinePath, clipPathId, textureFilterId, agingFilterId),
    buildParticleLayerString(scene, clipPathId),
    buildFiberLayerString(scene, clipPathId),
    buildGoldLayerString(scene, clipPathId),
    buildDeckleStrokeString(scene, outlinePath),
  ].join("");

  return { defs, body };
}

export function renderXuanPaperSVGString(scene: XuanPaperScene): string {
  const { defs, body } = renderXuanPaperSVGParts(scene);
  return `<svg width="${scene.options.width}" height="${scene.options.height}" viewBox="0 0 ${scene.options.width} ${scene.options.height}" xmlns="${SVG_NS}"><defs>${defs}</defs>${body}</svg>`;
}

export function renderXuanPaperSVG(scene: XuanPaperScene): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", String(scene.options.width));
  svg.setAttribute("height", String(scene.options.height));
  svg.setAttribute("viewBox", `0 0 ${scene.options.width} ${scene.options.height}`);
  svg.setAttribute("xmlns", SVG_NS);

  const defs = document.createElementNS(SVG_NS, "defs");
  const textureFilterId = `xuan-paper-texture-${scene.options.seed}`;
  const agingFilterId = `xuan-paper-aging-${scene.options.seed}`;
  const clipPathId = `xuan-paper-clip-${scene.options.seed}`;
  const outlinePath = buildOutlinePathData(
    scene.deckleOutline,
    scene.options.width,
    scene.options.height,
  );

  appendTextureFilter(defs, textureFilterId, scene);
  appendAgingFilter(defs, agingFilterId, scene);

  const clipPath = document.createElementNS(SVG_NS, "clipPath");
  clipPath.setAttribute("id", clipPathId);
  const clipShape = document.createElementNS(SVG_NS, "path");
  clipShape.setAttribute("d", outlinePath);
  clipPath.appendChild(clipShape);
  defs.appendChild(clipPath);

  svg.appendChild(defs);

  appendPaperLayers(svg, scene, outlinePath, clipPathId, textureFilterId, agingFilterId);
  appendParticleLayer(svg, scene, clipPathId);
  appendFiberLayer(svg, scene, clipPathId);
  appendGoldLayer(svg, scene, clipPathId);
  appendDeckleStroke(svg, scene, outlinePath);

  return svg;
}
