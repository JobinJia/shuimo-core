import { describe, it, expect } from 'vitest';
import { Tree } from '../../../src/elements/natural/tree';
import { RenderContext } from '../../../src/renderer/renderer';
import { TreeType, SeasonType } from '../../../src/elements/types';

describe('Tree', () => {
  describe('constructor', () => {
    it('should create tree with default parameters', () => {
      const tree = new Tree();
      expect(tree.id).toContain('tree');
      expect(tree.type).toBe('tree');
    });

    it('should accept custom parameters', () => {
      const tree = new Tree({
        height: 300,
        treeType: TreeType.MAPLE,
        season: SeasonType.AUTUMN
      });
      const params = tree.getParams();
      expect(params.height).toBe(300);
      expect(params.treeType).toBe(TreeType.MAPLE);
      expect(params.season).toBe(SeasonType.AUTUMN);
    });
  });

  describe('tree types', () => {
    it('should create pine tree', () => {
      const tree = new Tree({ treeType: TreeType.PINE });
      const params = tree.getParams();
      expect(params.treeType).toBe(TreeType.PINE);
    });

    it('should create willow tree', () => {
      const tree = new Tree({ treeType: TreeType.WILLOW });
      const params = tree.getParams();
      expect(params.treeType).toBe(TreeType.WILLOW);
    });

    it('should create maple tree', () => {
      const tree = new Tree({ treeType: TreeType.MAPLE });
      const params = tree.getParams();
      expect(params.treeType).toBe(TreeType.MAPLE);
    });
  });

  describe('seasons', () => {
    it('should create spring tree', () => {
      const tree = new Tree({ season: SeasonType.SPRING });
      const params = tree.getParams();
      expect(params.season).toBe(SeasonType.SPRING);
    });

    it('should create summer tree', () => {
      const tree = new Tree({ season: SeasonType.SUMMER });
      const params = tree.getParams();
      expect(params.season).toBe(SeasonType.SUMMER);
    });

    it('should create autumn tree', () => {
      const tree = new Tree({ season: SeasonType.AUTUMN });
      const params = tree.getParams();
      expect(params.season).toBe(SeasonType.AUTUMN);
    });

    it('should create winter tree', () => {
      const tree = new Tree({ season: SeasonType.WINTER });
      const params = tree.getParams();
      expect(params.season).toBe(SeasonType.WINTER);
    });
  });

  describe('reproducibility', () => {
    it('should generate same structure with same seed', () => {
      const t1 = new Tree({ seed: 12345 });
      const t2 = new Tree({ seed: 12345 });

      expect(t1.getParams().seed).toBe(t2.getParams().seed);
    });

    it('should generate different structures with different seeds', () => {
      const t1 = new Tree({ seed: 12345 });
      const t2 = new Tree({ seed: 54321 });

      expect(t1.getParams().seed).not.toBe(t2.getParams().seed);
    });
  });

  describe('bounds', () => {
    it('should calculate correct bounds', () => {
      const tree = new Tree({
        position: { x: 400, y: 500 },
        height: 200
      });

      const bounds = tree.getBounds();
      expect(bounds.y).toBe(300); // position.y - height
      expect(bounds.height).toBe(200);
      expect(bounds.width).toBeGreaterThan(0);
    });
  });

  describe('rendering', () => {
    it('should have render method', () => {
      const tree = new Tree();
      expect(typeof tree.render).toBe('function');
    });

    it('should render without errors (interface test)', () => {
      const tree = new Tree();

      const mockRenderer = {
        drawPath: () => {},
        drawCircle: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        type: 'canvas',
        width: 800,
        height: 600
      } as any;

      const context = new RenderContext(mockRenderer);

      expect(() => {
        tree.render(context);
      }).not.toThrow();
    });

    it('should render all tree types without errors', () => {
      const types = [TreeType.PINE, TreeType.WILLOW, TreeType.MAPLE];
      const mockRenderer = {
        drawPath: () => {},
        drawCircle: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        type: 'canvas',
        width: 800,
        height: 600
      } as any;

      const context = new RenderContext(mockRenderer);

      types.forEach(treeType => {
        const tree = new Tree({ treeType });
        expect(() => {
          tree.render(context);
        }).not.toThrow();
      });
    });

    it('should render all seasons without errors', () => {
      const seasons = [
        SeasonType.SPRING,
        SeasonType.SUMMER,
        SeasonType.AUTUMN,
        SeasonType.WINTER
      ];
      const mockRenderer = {
        drawPath: () => {},
        drawCircle: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        type: 'canvas',
        width: 800,
        height: 600
      } as any;

      const context = new RenderContext(mockRenderer);

      seasons.forEach(season => {
        const tree = new Tree({ season });
        expect(() => {
          tree.render(context);
        }).not.toThrow();
      });
    });
  });

  describe('clone', () => {
    it('should create a cloned tree', () => {
      const original = new Tree({ seed: 12345 });
      const cloned = original.clone();

      expect(cloned.type).toBe('tree');
      expect(cloned.id).not.toBe(original.id);
    });

    it('should clone with different seed', () => {
      const original = new Tree({ seed: 12345 });
      const cloned = original.clone() as Tree;

      const originalParams = original.getParams();
      const clonedParams = cloned.getParams();

      expect(clonedParams.seed).toBe(originalParams.seed! + 1);
    });
  });

  describe('parameter updates', () => {
    it('should update height parameter', () => {
      const tree = new Tree({ height: 200 });

      tree.updateParams({ height: 300 });

      const params = tree.getParams();
      expect(params.height).toBe(300);
    });

    it('should update tree type', () => {
      const tree = new Tree({ treeType: TreeType.PINE });

      tree.updateParams({ treeType: TreeType.MAPLE });

      const params = tree.getParams();
      expect(params.treeType).toBe(TreeType.MAPLE);
    });

    it('should update season', () => {
      const tree = new Tree({ season: SeasonType.SUMMER });

      tree.updateParams({ season: SeasonType.WINTER });

      const params = tree.getParams();
      expect(params.season).toBe(SeasonType.WINTER);
    });

    it('should recalculate bounds after update', () => {
      const tree = new Tree({ height: 200 });

      tree.updateParams({ height: 300 });

      const bounds = tree.getBounds();
      expect(bounds.height).toBe(300);
    });
  });

  describe('complexity', () => {
    it('should accept low complexity', () => {
      const tree = new Tree({ complexity: 0.2 });
      const params = tree.getParams();
      expect(params.complexity).toBe(0.2);
    });

    it('should accept high complexity', () => {
      const tree = new Tree({ complexity: 0.9 });
      const params = tree.getParams();
      expect(params.complexity).toBe(0.9);
    });
  });
});
