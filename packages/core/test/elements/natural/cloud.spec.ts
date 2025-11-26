import { describe, it, expect } from 'vitest';
import { Cloud, type CloudParams } from '../../../src/elements/natural/cloud';

describe('Cloud', () => {
  describe('constructor', () => {
    it('should create a cloud with default parameters', () => {
      const cloud = new Cloud();

      expect(cloud).toBeInstanceOf(Cloud);
      expect(cloud.id).toMatch(/^cloud-/);
      expect(cloud.type).toBe('cloud');
    });

    it('should accept custom parameters', () => {
      const params: Partial<CloudParams> = {
        position: { x: 100, y: 200 },
        width: 250,
        height: 120,
        seed: 12345,
        density: 0.8,
        opacity: 0.7,
        layers: 4,
      };

      const cloud = new Cloud(params);
      expect(cloud).toBeInstanceOf(Cloud);
    });

    it('should use seed for reproducible generation', () => {
      const cloud1 = new Cloud({ seed: 42 });
      const cloud2 = new Cloud({ seed: 42 });

      expect(cloud1.getBounds()).toEqual(cloud2.getBounds());
    });
  });

  describe('getBounds', () => {
    it('should calculate bounds based on width and height', () => {
      const cloud = new Cloud({
        position: { x: 200, y: 100 },
        width: 200,
        height: 100,
      });

      const bounds = cloud.getBounds();

      expect(bounds.x).toBe(100); // 200 - 200/2
      expect(bounds.y).toBe(50); // 100 - 100/2
      expect(bounds.width).toBe(200);
      expect(bounds.height).toBe(100);
    });

    it('should handle different positions', () => {
      const cloud = new Cloud({
        position: { x: 300, y: 150 },
        width: 300,
        height: 150,
      });

      const bounds = cloud.getBounds();

      expect(bounds.x).toBe(150); // 300 - 300/2
      expect(bounds.y).toBe(75); // 150 - 150/2
    });
  });

  describe('parameters', () => {
    it('should handle different density values', () => {
      const cloud1 = new Cloud({ seed: 42, density: 0.3 });
      const cloud2 = new Cloud({ seed: 42, density: 0.9 });

      expect(cloud1).toBeInstanceOf(Cloud);
      expect(cloud2).toBeInstanceOf(Cloud);
    });

    it('should handle different opacity values', () => {
      const cloud1 = new Cloud({ seed: 42, opacity: 0.3 });
      const cloud2 = new Cloud({ seed: 42, opacity: 0.9 });

      expect(cloud1).toBeInstanceOf(Cloud);
      expect(cloud2).toBeInstanceOf(Cloud);
    });

    it('should handle different layer counts', () => {
      const cloud1 = new Cloud({ seed: 42, layers: 2 });
      const cloud2 = new Cloud({ seed: 42, layers: 5 });

      expect(cloud1).toBeInstanceOf(Cloud);
      expect(cloud2).toBeInstanceOf(Cloud);
    });
  });

  describe('size variations', () => {
    it('should handle small clouds', () => {
      const cloud = new Cloud({
        width: 100,
        height: 50,
        seed: 42
      });

      expect(cloud.getBounds().width).toBe(100);
      expect(cloud.getBounds().height).toBe(50);
    });

    it('should handle large clouds', () => {
      const cloud = new Cloud({
        width: 300,
        height: 150,
        seed: 42
      });

      expect(cloud.getBounds().width).toBe(300);
      expect(cloud.getBounds().height).toBe(150);
    });

    it('should handle wide clouds', () => {
      const cloud = new Cloud({
        width: 300,
        height: 80,
        seed: 42
      });

      const bounds = cloud.getBounds();
      expect(bounds.width).toBeGreaterThan(bounds.height);
    });

    it('should handle tall clouds', () => {
      const cloud = new Cloud({
        width: 100,
        height: 150,
        seed: 42
      });

      const bounds = cloud.getBounds();
      expect(bounds.height).toBeGreaterThan(bounds.width);
    });
  });

  describe('edge cases', () => {
    it('should handle minimal size', () => {
      const cloud = new Cloud({
        width: 10,
        height: 10,
        seed: 42
      });

      expect(cloud).toBeInstanceOf(Cloud);
    });

    it('should handle negative position', () => {
      const cloud = new Cloud({
        position: { x: -100, y: -200 },
        seed: 42
      });

      expect(cloud).toBeInstanceOf(Cloud);
      expect(cloud.getBounds().x).toBeLessThan(0);
    });
  });
});
