export interface ContentArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutCell {
  index: number;
  char: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** radians; non-zero for circular layout where glyphs face outward */
  rotation?: number;
}

export interface GridLayoutOptions {
  /**
   * Flat string (auto column split) OR array where each element is one
   * column's characters (explicit column assignment per v1 spec).
   */
  text: string | string[];
  area: ContentArea;
  direction: "ttb-rtl" | "circular";
  columns?: number;
  /** Shared default. `rowGap` / `columnGap` override per axis when set. */
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  /**
   * Optional per-column widths (column-major layouts only). When supplied,
   * cells become rectangular and each column hugs its widest glyph; without
   * it, cells fall back to square (em-square) sizing.
   * Indices match `text` array order (left→right == columns[0..n-1]).
   */
  columnWidths?: number[];
}

export function layoutGrid(opts: GridLayoutOptions): LayoutCell[] {
  // Explicit column array → column-major layout
  if (Array.isArray(opts.text)) {
    return layoutColumns(opts.text, opts);
  }
  const chars = Array.from(opts.text);
  if (chars.length === 0) return [];
  if (opts.direction === "circular") return layoutCircular(chars, opts);
  return layoutTtbRtl(chars, opts);
}

/**
 * Column-major layout matching v1's `text: string[]` convention:
 * each array element is one column read top-to-bottom, columns ordered
 * right-to-left in the seal (ttb-rtl).
 */
/**
 * Column-major layout matching v1's `text: string[]` convention.
 * Cells are kept SQUARE (side = min available per-cell dimension) so
 * characters maintain natural 篆书 proportions instead of stretching.
 * Excess space is distributed as inter-column and inter-row gaps.
 */
function layoutColumns(columns: string[], opts: GridLayoutOptions): LayoutCell[] {
  const numCols = columns.length;
  if (numCols === 0) return [];
  const maxRows = Math.max(...columns.map((c) => Array.from(c).length));
  if (maxRows === 0) return [];
  const fallback = opts.gap ?? 0;
  const rowGap = opts.rowGap ?? fallback;
  const columnGap = opts.columnGap ?? fallback;

  // Two modes: explicit per-column widths (caller measured glyph aspects) or
  // square fallback. Row height is shared across columns either way.
  let cellH: number;
  let colWidths: number[];
  const provided = opts.columnWidths;
  if (provided && provided.length === numCols) {
    cellH = (opts.area.h - rowGap * (maxRows - 1)) / maxRows;
    colWidths = provided;
  } else {
    const availW = opts.area.w - columnGap * (numCols - 1);
    const availH = opts.area.h - rowGap * (maxRows - 1);
    const cellSide = Math.min(availW / numCols, availH / maxRows);
    cellH = cellSide;
    colWidths = new Array(numCols).fill(cellSide);
  }

  const gridW = colWidths.reduce((s, w) => s + w, 0) + columnGap * (numCols - 1);
  const gridH = cellH * maxRows + rowGap * (maxRows - 1);
  const ox = opts.area.x + (opts.area.w - gridW) / 2;
  const oy = opts.area.y + (opts.area.h - gridH) / 2;

  // X offset per column index (left→right). Columns are placed in the order
  // they were provided; the reading-order swap (ttb-rtl puts the first
  // column at the rightmost slot) happens at the per-row assignment below.
  const colXFromLeft: number[] = [];
  let xCur = 0;
  for (let j = 0; j < numCols; j++) {
    colXFromLeft.push(xCur);
    xCur += colWidths[j] + columnGap;
  }

  const cells: LayoutCell[] = [];
  let index = 0;
  for (let col = 0; col < numCols; col++) {
    const chars = Array.from(columns[col]);
    const colFromLeft = numCols - 1 - col;
    const cellW = colWidths[colFromLeft];
    for (let row = 0; row < chars.length; row++) {
      const x = ox + colXFromLeft[colFromLeft];
      const y = oy + row * (cellH + rowGap);
      cells.push({ index: index++, char: chars[row], x, y, w: cellW, h: cellH });
    }
  }
  return cells;
}

function layoutTtbRtl(chars: string[], opts: GridLayoutOptions): LayoutCell[] {
  const n = chars.length;
  const columns = Math.max(1, opts.columns ?? defaultColumns(n));
  const rows = Math.ceil(n / columns);
  const fallback = opts.gap ?? 0;
  const rowGap = opts.rowGap ?? fallback;
  const columnGap = opts.columnGap ?? fallback;
  const cellW = (opts.area.w - columnGap * (columns - 1)) / columns;
  const cellH = (opts.area.h - rowGap * (rows - 1)) / rows;
  const cells: LayoutCell[] = [];
  for (let i = 0; i < n; i++) {
    // Read order: ttb-rtl — start top-right, fill column top→bottom, then column left.
    const col = Math.floor(i / rows);
    const row = i % rows;
    const colFromLeft = columns - 1 - col;
    const x = opts.area.x + colFromLeft * (cellW + columnGap);
    const y = opts.area.y + row * (cellH + rowGap);
    cells.push({ index: i, char: chars[i], x, y, w: cellW, h: cellH });
  }
  return cells;
}

function layoutCircular(chars: string[], opts: GridLayoutOptions): LayoutCell[] {
  const n = chars.length;
  const cx = opts.area.x + opts.area.w / 2;
  const cy = opts.area.y + opts.area.h / 2;
  const outerR = Math.min(opts.area.w, opts.area.h) / 2;
  const ringR = outerR * 0.72;
  const cellSize = outerR * 0.34;
  const cells: LayoutCell[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    // Start at top, sweep clockwise (matches traditional right-to-left reading on a round seal).
    const angle = -Math.PI / 2 + t * Math.PI * 2;
    const x = cx + Math.cos(angle) * ringR - cellSize / 2;
    const y = cy + Math.sin(angle) * ringR - cellSize / 2;
    cells.push({
      index: i,
      char: chars[i],
      x,
      y,
      w: cellSize,
      h: cellSize,
      rotation: angle + Math.PI / 2,
    });
  }
  return cells;
}

function defaultColumns(n: number): number {
  if (n <= 1) return 1;
  // 2 chars in a square seal traditionally sit side-by-side, not stacked,
  // so the cells are square-ish rather than 2:1 wide.
  if (n === 2) return 2;
  if (n === 4) return 2;
  return Math.ceil(Math.sqrt(n));
}
