/**
 * shuimo-core
 *
 * A TypeScript library for procedural Chinese landscape painting generation
 *
 * @packageDocumentation
 */

// Foundation exports
export * from './foundation';

// Renderer exports (excluding types that conflict with foundation)
export { Renderer, RenderContext } from './renderer/renderer';
export { CanvasRenderer } from './renderer/canvas';
export { SVGRenderer } from './renderer/svg';
export { colorToCSS, colorToHex } from './renderer/types';
