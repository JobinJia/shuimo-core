import { describe, it, expect } from 'vitest';
import { BaseElement } from '../../../src/elements/base/element';
import type { RenderContext, IElement } from '../../../src/foundation/types';

// 创建测试用的具体实现
class TestElement extends BaseElement {
  constructor(id: string) {
    super(id, 'test-element');
    this._bounds = this.calculateBounds();
  }

  render(context: RenderContext): void {
    // 测试实现
  }

  clone(): IElement {
    return new TestElement(`${this.id}-clone`);
  }

  protected calculateBounds() {
    return { x: 0, y: 0, width: 100, height: 100 };
  }
}

describe('BaseElement', () => {
  describe('constructor', () => {
    it('should create element with id and type', () => {
      const element = new TestElement('test-1');
      expect(element.id).toBe('test-1');
      expect(element.type).toBe('test-element');
    });
  });

  describe('bounds', () => {
    it('should have bounds property', () => {
      const element = new TestElement('test-1');
      const bounds = element.bounds;
      expect(bounds).toHaveProperty('x');
      expect(bounds).toHaveProperty('y');
      expect(bounds).toHaveProperty('width');
      expect(bounds).toHaveProperty('height');
    });

    it('should return calculated bounds', () => {
      const element = new TestElement('test-1');
      const bounds = element.getBounds();
      expect(bounds.width).toBe(100);
      expect(bounds.height).toBe(100);
    });
  });

  describe('parameters', () => {
    it('should set and get parameters', () => {
      const element = new TestElement('test-1');
      element.setParameter('test', 42);
      expect(element.getParameter('test')).toBe(42);
    });

    it('should return parameter keys', () => {
      const element = new TestElement('test-1');
      element.setParameter('key1', 1);
      element.setParameter('key2', 2);
      const keys = element.getParameterKeys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
  });

  describe('clone', () => {
    it('should create a cloned element', () => {
      const element = new TestElement('test-1');
      const cloned = element.clone();
      expect(cloned.id).toContain('clone');
      expect(cloned.type).toBe(element.type);
    });
  });
});
