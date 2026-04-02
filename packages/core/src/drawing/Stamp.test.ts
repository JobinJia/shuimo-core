import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateStampPath, measureStampText } from './Stamp';

describe('Stamp layout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses measured column heights with a small safety buffer for rectangle bounds', () => {
    const result = generateStampPath({
      text: ['月落', '乌啼'],
      shape: 'rectangle',
      fontSize: 70,
      paddingYPx: 10,
      measuredColumnWidths: [38, 38],
      measuredColumnHeights: [130, 130],
      seed: 1,
      regularShape: true,
    });

    expect(result.bounds.height).toBeCloseTo(153.5, 3);
  });

  it('keeps auto shape tall enough for the tallest middle column', () => {
    const result = generateStampPath({
      text: ['甲', '中中中', '乙'],
      shape: 'auto',
      fontSize: 70,
      paddingYPx: 10,
      measuredColumnWidths: [38, 38, 38],
      measuredColumnHeights: [70, 210, 70],
      seed: 1,
    });

    expect(result.bounds.height).toBeCloseTo(233.5, 3);
  });

  it('uses characterSpacingPx when measuring text', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getBBox');

    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      value(this: SVGElement) {
        const letterSpacing = Number.parseFloat(this.style.letterSpacing || '0');
        return {
          x: 0,
          y: 0,
          width: 10,
          height: letterSpacing * 1000,
        };
      },
    });

    const result = measureStampText({
      text: ['印'],
      fontSize: 100,
      characterSpacingPx: 10,
    });

    if (originalDescriptor) {
      Object.defineProperty(SVGElement.prototype, 'getBBox', originalDescriptor);
    } else {
      delete (SVGElement.prototype as SVGElement & { getBBox?: unknown }).getBBox;
    }

    expect(result?.columnHeights[0]).toBeCloseTo(100, 3);
  });
});
