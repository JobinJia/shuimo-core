import { generateRidge } from "./RidgeGenerator";
import { generateCunFaStrokes } from "./CunFaEngine";
import { generateInkFill } from "./InkWashLayer";
import { generateMist } from "./MistLayer";
import { Canvas2DBackend } from "./renderer/Canvas2DBackend";
import type {
  InkMountOptions,
  InkMountLayerOptions,
  InkMountScene,
  QualityPreset,
  RidgeOptions,
  CunFaOptions,
  MistOptions,
} from "./types";
import type { RenderBackend, RenderOutput } from "./renderer/types";

const QUALITY_PRESETS: Record<
  QualityPreset,
  { density: number; octaves: number; splashCount: number }
> = {
  draft: { density: 0.2, octaves: 4, splashCount: 0 },
  normal: { density: 0.5, octaves: 6, splashCount: 3 },
  high: { density: 0.85, octaves: 8, splashCount: 5 },
};

const DEFAULT_RIDGE: RidgeOptions = {
  peakCount: 2,
  sharpness: 3,
  subRidgeCount: 2,
  noiseOctaves: 6,
};
const DEFAULT_CUNFA: CunFaOptions = {
  density: 0.5,
  lengthRange: [15, 60],
  pressureCurve: [0.3, 1.0, 0.3],
};
const DEFAULT_MIST: MistOptions = { opacity: 0.8, frequency: 0.005, coverage: 0.6 };

export class InkMount {
  /**
   * Generate a complete multi-layer mountain scene.
   */
  static generateScene(options: InkMountOptions): InkMountScene {
    const { width, height, seed, quality = "normal", onLayer } = options;
    const preset = QUALITY_PRESETS[quality];

    const layerCount = options.layers ?? Math.min(10, Math.max(2, Math.floor(height / 120)));

    const ridge: RidgeOptions = {
      ...DEFAULT_RIDGE,
      ...options.ridge,
      noiseOctaves: options.ridge?.noiseOctaves ?? preset.octaves,
    };
    const cunfa: CunFaOptions = {
      ...DEFAULT_CUNFA,
      ...options.cunfa,
      density: options.cunfa?.density ?? preset.density,
    };
    const mistOpts: MistOptions = { ...DEFAULT_MIST, ...options.mist };

    const scene: InkMountScene = {
      layers: [],
      strokes: [],
      fills: [],
      mists: [],
      width,
      height,
    };

    // Generate layers from far (depth=0) to near (depth=1)
    for (let i = 0; i < layerCount; i++) {
      const depth = layerCount === 1 ? 0.5 : i / (layerCount - 1);

      const layer = generateRidge({
        width,
        height,
        seed: seed + i * 137,
        depth,
        resolution: Math.max(50, Math.floor(width / 4)),
        peakCount: ridge.peakCount,
        sharpness: ridge.sharpness,
        subRidgeCount: ridge.subRidgeCount,
        noiseOctaves: ridge.noiseOctaves,
      });

      const strokes = generateCunFaStrokes({
        layer,
        seed: seed + i * 251,
        density: cunfa.density,
        lengthRange: cunfa.lengthRange,
        pressureCurve: cunfa.pressureCurve,
      });

      const fill = generateInkFill({
        layer,
        seed: seed + i * 389,
        splashCount: preset.splashCount,
      });

      scene.layers.push(layer);
      scene.strokes.push(strokes);
      scene.fills.push(fill);

      if (onLayer) {
        onLayer(layer, i);
      }
    }

    // Generate mist between layers
    if (scene.layers.length >= 2) {
      scene.mists = generateMist({
        layers: scene.layers,
        width,
        height,
        seed: seed + 9999,
        opacity: mistOpts.opacity,
        frequency: mistOpts.frequency,
        coverage: mistOpts.coverage,
      });
    }

    return scene;
  }

  /**
   * Generate a single mountain layer scene (no mist).
   */
  static generateLayerScene(options: InkMountLayerOptions): InkMountScene {
    const { width, height, seed, depth, quality = "normal" } = options;
    const preset = QUALITY_PRESETS[quality];

    const ridge: RidgeOptions = {
      ...DEFAULT_RIDGE,
      ...options.ridge,
      noiseOctaves: options.ridge?.noiseOctaves ?? preset.octaves,
    };
    const cunfa: CunFaOptions = {
      ...DEFAULT_CUNFA,
      ...options.cunfa,
      density: options.cunfa?.density ?? preset.density,
    };

    const layer = generateRidge({
      width,
      height,
      seed,
      depth,
      resolution: Math.max(50, Math.floor(width / 4)),
      peakCount: ridge.peakCount,
      sharpness: ridge.sharpness,
      subRidgeCount: ridge.subRidgeCount,
      noiseOctaves: ridge.noiseOctaves,
    });

    const strokes = generateCunFaStrokes({
      layer,
      seed: seed + 251,
      density: cunfa.density,
      lengthRange: cunfa.lengthRange,
      pressureCurve: cunfa.pressureCurve,
    });

    const fill = generateInkFill({
      layer,
      seed: seed + 389,
      splashCount: preset.splashCount,
    });

    return {
      layers: [layer],
      strokes: [strokes],
      fills: [fill],
      mists: [],
      width,
      height,
    };
  }

  /**
   * Generate a complete scene and render it to a backend.
   */
  static generate(options: InkMountOptions): RenderOutput {
    const scene = InkMount.generateScene(options);
    const backend = InkMount.createBackend(options);
    InkMount.renderScene(scene, backend);
    return backend.toOutput();
  }

  /**
   * Generate a single layer and render it to a backend.
   */
  static generateLayer(options: InkMountLayerOptions): RenderOutput {
    const scene = InkMount.generateLayerScene(options);
    const backend = InkMount.createBackend(options);
    InkMount.renderScene(scene, backend);
    return backend.toOutput();
  }

  /**
   * Render a pre-generated scene to a backend.
   */
  static renderScene(scene: InkMountScene, backend: RenderBackend): void {
    backend.clear();

    const mistPerGap =
      scene.layers.length > 1 ? Math.ceil(scene.mists.length / (scene.layers.length - 1)) : 0;

    // Render layers back-to-front (far to near, depth ascending)
    for (let i = 0; i < scene.layers.length; i++) {
      const layer = scene.layers[i];
      const strokes = scene.strokes[i];
      const fill = scene.fills[i];
      const { depth } = layer;

      // Draw mountain fill
      backend.drawMountainFill(layer, fill);

      // Draw cunfa strokes (clipped to mountain body)
      backend.drawCunFaStrokes(strokes, layer);

      // Draw main ridge line
      const ridgeOpacity = 0.15 + depth * 0.4;
      const ridgeWidth = 0.3 + depth * 0.7;
      backend.drawRidgeLine(layer.ridgeLine, ridgeOpacity, ridgeWidth);

      // Draw sub-ridges at 40% opacity and 50% width
      for (const subRidge of layer.subRidges) {
        backend.drawRidgeLine(subRidge, ridgeOpacity * 0.4, ridgeWidth * 0.5);
      }

      // Draw mist between this layer and the next
      if (i < scene.layers.length - 1 && scene.mists.length > 0) {
        const mistStart = i * mistPerGap;
        const mistEnd = Math.min(mistStart + mistPerGap, scene.mists.length);
        if (mistStart < scene.mists.length) {
          backend.drawMist(scene.mists.slice(mistStart, mistEnd));
        }
      }
    }
  }

  /**
   * Create a render backend based on options.
   */
  private static createBackend(options: {
    width: number;
    height: number;
    ctx?: CanvasRenderingContext2D;
  }): RenderBackend {
    return new Canvas2DBackend({
      width: options.width,
      height: options.height,
      ctx: options.ctx,
    });
  }
}
