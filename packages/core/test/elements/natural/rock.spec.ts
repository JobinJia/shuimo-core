import { describe, it, expect } from 'vitest';
import { Rock, type RockParams } from '../../../src/elements/natural/rock';

describe('Rock', () => {

  describe('constructor', () => {
    it('should create a rock with default parameters', () => {
      const rock = new Rock();

      expect(rock).toBeInstanceOf(Rock);
      expect(rock.id).toMatch(/^rock-/);
      expect(rock.type).toBe('rock');
    });

    it('should accept custom parameters', () => {
      const params: Partial<RockParams> = {
        position: { x: 100, y: 200 },
        width: 50,
        height: 40,
        seed: 12345,
        texture: 30,
        shading: 15,
      };

      const rock = new Rock(params);
      expect(rock).toBeInstanceOf(Rock);
    });

    it('should use seed for reproducible generation', () => {
      const rock1 = new Rock({ seed: 42 });
      const rock2 = new Rock({ seed: 42 });

      expect(rock1.getBounds()).toEqual(rock2.getBounds());
    });

    it('should generate different rocks with different seeds', () => {
      const rock1 = new Rock({ seed: 42 });
      const rock2 = new Rock({ seed: 43 });

      // Bounds should be same (based on params) but rendering will differ
      expect(rock1.id).not.toBe(rock2.id);
    });
  });

  describe('getBounds', () => {
    it('should calculate bounds based on width and height', () => {
      const rock = new Rock({
        position: { x: 100, y: 100 },
        width: 50,
        height: 40,
      });

      const bounds = rock.getBounds();

      expect(bounds.x).toBe(50); // 100 - 50
      expect(bounds.y).toBe(92); // 100 - 40 * 0.2
      expect(bounds.width).toBe(100); // 50 * 2
      expect(bounds.height).toBe(48); // 40 * 1.2
    });

    it('should handle different positions', () => {
      const rock = new Rock({
        position: { x: 200, y: 300 },
        width: 80,
        height: 60,
      });

      const bounds = rock.getBounds();

      expect(bounds.x).toBe(120); // 200 - 80
      expect(bounds.y).toBe(288); // 300 - 60 * 0.2
      expect(bounds.width).toBe(160); // 80 * 2
      expect(bounds.height).toBe(72); // 60 * 1.2
    });
  });

  describe('render', () => {
    it('should have valid bounds', () => {
      const rock = new Rock({ seed: 42 });
      const bounds = rock.getBounds();

      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);
    });
  });

  describe('texture and shading', () => {
    it('should handle different texture values', () => {
      const rock1 = new Rock({ seed: 42, texture: 10 });
      const rock2 = new Rock({ seed: 42, texture: 30 });
      const rock3 = new Rock({ seed: 42, texture: 100 });

      expect(rock1).toBeInstanceOf(Rock);
      expect(rock2).toBeInstanceOf(Rock);
      expect(rock3).toBeInstanceOf(Rock);
    });

    it('should handle zero texture', () => {
      const rock = new Rock({ seed: 42, texture: 0 });
      expect(rock).toBeInstanceOf(Rock);
    });
  });

  describe('shape generation', () => {
    it('should generate elliptical shape', () => {
      const rock = new Rock({
        width: 100,
        height: 50,
        seed: 42
      });

      const bounds = rock.getBounds();

      // Bounds should reflect the elliptical proportions
      expect(bounds.width).toBeGreaterThan(bounds.height);
    });

    it('should handle square-like rocks', () => {
      const rock = new Rock({
        width: 60,
        height: 60,
        seed: 42
      });

      expect(rock).toBeInstanceOf(Rock);
    });

    it('should handle tall rocks', () => {
      const rock = new Rock({
        width: 30,
        height: 80,
        seed: 42
      });

      const bounds = rock.getBounds();
      expect(bounds.height).toBeGreaterThan(bounds.width);
    });

    it('should handle small rocks', () => {
      const rock = new Rock({
        width: 20,
        height: 15,
        seed: 42
      });

      expect(rock).toBeInstanceOf(Rock);
    });

    it('should handle large rocks', () => {
      const rock = new Rock({
        width: 100,
        height: 80,
        seed: 42
      });

      expect(rock).toBeInstanceOf(Rock);
    });
  });

  describe('edge cases', () => {
    it('should handle minimal size', () => {
      const rock = new Rock({
        width: 1,
        height: 1,
        seed: 42
      });

      expect(rock).toBeInstanceOf(Rock);
    });

    it('should handle zero shading', () => {
      const rock = new Rock({
        shading: 0,
        seed: 42
      });

      expect(rock).toBeInstanceOf(Rock);
    });

    it('should handle high shading values', () => {
      const rock = new Rock({
        shading: 50,
        seed: 42
      });

      expect(rock).toBeInstanceOf(Rock);
    });

    it('should handle negative position', () => {
      const rock = new Rock({
        position: { x: -100, y: -200 },
        seed: 42
      });

      expect(rock).toBeInstanceOf(Rock);
      expect(rock.getBounds().x).toBeLessThan(0);
    });
  });
});
