export { PerlinNoise, noise } from "./PerlinNoise";
export { fractalNoise } from "./FractalNoise";
export { SimplexNoise } from "./SimplexNoise";
export { WorleyNoise } from "./WorleyNoise";
export { GaborNoise, type GaborNoiseOptions } from "./GaborNoise";

// WASM-accelerated noise (opt-in, requires wasm file served alongside)
export { WasmNoise, initWasmNoiseEngine, getSharedWasmNoise } from "./wasm-noise";
export type { WasmNoiseOptions, WasmNoiseInitOptions } from "./wasm-noise";
