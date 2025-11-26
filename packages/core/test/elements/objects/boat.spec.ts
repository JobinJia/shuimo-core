import { describe, it, expect } from 'vitest';
import { Boat, type BoatParams } from '../../../src/elements/objects/boat';

describe('Boat', () => {
  describe('constructor', () => {
    it('should create a boat with default parameters', () => {
      const boat = new Boat();

      expect(boat).toBeInstanceOf(Boat);
      expect(boat.id).toMatch(/^boat-/);
      expect(boat.type).toBe('boat');
    });

    it('should accept custom parameters', () => {
      const params: Partial<BoatParams> = {
        position: { x: 100, y: 200 },
        length: 80,
        seed: 12345,
        scale: 1.5,
        flipped: true,
      };

      const boat = new Boat(params);
      expect(boat).toBeInstanceOf(Boat);
    });

    it('should use seed for reproducible generation', () => {
      const boat1 = new Boat({ seed: 42 });
      const boat2 = new Boat({ seed: 42 });

      expect(boat1.getBounds()).toEqual(boat2.getBounds());
    });
  });

  describe('getBounds', () => {
    it('should calculate bounds based on length and scale', () => {
      const boat = new Boat({
        position: { x: 100, y: 100 },
        length: 120,
        scale: 1,
        flipped: false,
      });

      const bounds = boat.getBounds();

      expect(bounds.x).toBe(100);
      expect(bounds.y).toBe(100);
      expect(bounds.width).toBe(120); // length * scale
      expect(bounds.height).toBe(10); // 10 * scale
    });

    it('should handle scaled boats', () => {
      const boat = new Boat({
        position: { x: 100, y: 100 },
        length: 100,
        scale: 2,
        flipped: false,
      });

      const bounds = boat.getBounds();

      expect(bounds.width).toBe(200); // 100 * 2
      expect(bounds.height).toBe(20); // 10 * 2
    });

    it('should handle flipped boats', () => {
      const boat = new Boat({
        position: { x: 100, y: 100 },
        length: 120,
        scale: 1,
        flipped: true,
      });

      const bounds = boat.getBounds();

      expect(bounds.x).toBe(-20); // position.x - width
      expect(bounds.width).toBe(120);
    });
  });

  describe('scale parameter', () => {
    it('should affect boat size', () => {
      const boat1 = new Boat({ length: 100, scale: 0.5 });
      const boat2 = new Boat({ length: 100, scale: 2 });

      const bounds1 = boat1.getBounds();
      const bounds2 = boat2.getBounds();

      expect(bounds2.width).toBe(bounds1.width * 4);
      expect(bounds2.height).toBe(bounds1.height * 4);
    });

    it('should handle small scales', () => {
      const boat = new Boat({ scale: 0.5 });
      expect(boat).toBeInstanceOf(Boat);
    });

    it('should handle large scales', () => {
      const boat = new Boat({ scale: 3 });
      expect(boat).toBeInstanceOf(Boat);
    });
  });

  describe('flipped parameter', () => {
    it('should flip boat direction', () => {
      const boat1 = new Boat({ position: { x: 100, y: 100 }, flipped: false });
      const boat2 = new Boat({ position: { x: 100, y: 100 }, flipped: true });

      const bounds1 = boat1.getBounds();
      const bounds2 = boat2.getBounds();

      // Flipped boat should have different x position
      expect(bounds1.x).not.toBe(bounds2.x);
      expect(bounds1.width).toBe(bounds2.width);
    });

    it('should handle flipped boat', () => {
      const boat = new Boat({ flipped: true });
      expect(boat).toBeInstanceOf(Boat);
    });
  });

  describe('length parameter', () => {
    it('should affect boat length', () => {
      const boat1 = new Boat({ length: 60, scale: 1 });
      const boat2 = new Boat({ length: 120, scale: 1 });

      const bounds1 = boat1.getBounds();
      const bounds2 = boat2.getBounds();

      expect(bounds2.width).toBe(bounds1.width * 2);
    });

    it('should handle short boats', () => {
      const boat = new Boat({ length: 30 });
      expect(boat).toBeInstanceOf(Boat);
    });

    it('should handle long boats', () => {
      const boat = new Boat({ length: 200 });
      expect(boat).toBeInstanceOf(Boat);
    });
  });

  describe('edge cases', () => {
    it('should handle minimal length', () => {
      const boat = new Boat({ length: 10, scale: 0.5 });
      expect(boat).toBeInstanceOf(Boat);
    });

    it('should handle negative position', () => {
      const boat = new Boat({
        position: { x: -100, y: -200 }
      });

      expect(boat).toBeInstanceOf(Boat);
    });

    it('should handle small scale', () => {
      const boat = new Boat({ scale: 0.1 });
      expect(boat).toBeInstanceOf(Boat);
    });
  });
});
