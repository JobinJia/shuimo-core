import { MountPlanner, PlanItem } from "./MountPlanner";
import { Mount } from "../elements/natural/Mount";
import { water } from "../elements/natural/Water";
import { Arch } from "../elements/objects/Arch";
import { prng } from "../foundation/random";
import { randChoice } from "../utils/random";

export interface Chunk {
  /** Element type tag */
  tag: string;
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Rendered SVG content or polygon data */
  canv: string | [import("../foundation/geometry").Polygon[]];
}

export interface SceneState {
  /** Accumulated canvas/SVG content */
  canv: string;
  /** All chunks in the scene */
  chunks: Chunk[];
  /** Minimum x coordinate loaded */
  xmin: number;
  /** Maximum x coordinate loaded */
  xmax: number;
  /** Chunk width */
  cwid: number;
  /** Current viewport x position */
  cursx: number;
  /** Last tick time */
  lasttick: number;
  /** Window/viewport width */
  windx: number;
  /** Window/viewport height */
  windy: number;
  /** Planning matrix for tracking mountain placement */
  planmtx: number[];
  /**
   * Cross-chunk accumulator of placed `mount` / `flatmount` items. Threaded
   * through every `MountPlanner.plan()` call so boat placement in a new
   * chunk can reject candidates that would land on a mountain whose center
   * lives in a previous chunk (mountains are up to 600 wide, flatmounts up
   * to 1000 — both can span well past `cwid=512` chunk boundaries).
   */
  landRegistry: PlanItem[];
}

/**
 * SceneManager - Manage infinite scrolling landscape scene
 * Handles chunk loading, rendering, and viewport management
 */
export class SceneManager {
  private state: SceneState;
  private contentDirty: boolean = true; // Track if content (chunks) changed

  constructor(windx: number = 3000, windy: number = 800, cwid: number = 512) {
    this.state = {
      canv: "",
      chunks: [],
      xmin: 0,
      xmax: 0,
      cwid: cwid,
      cursx: 0,
      lasttick: 0,
      windx: windx,
      windy: windy,
      planmtx: [],
      landRegistry: [],
    };
  }

  /**
   * Get current scene state
   */
  getState(): SceneState {
    return this.state;
  }

  /**
   * Add a chunk to the scene in sorted order by y-coordinate
   */
  private addChunk(nch: Chunk): void {
    // Handle NaN values (only for string canv)
    if (typeof nch.canv === "string" && nch.canv.includes("NaN")) {
      nch.canv = nch.canv.replace(/NaN/g, "-1000");
    }

    if (this.state.chunks.length === 0) {
      this.state.chunks.push(nch);
      return;
    } else {
      if (nch.y <= this.state.chunks[0].y) {
        this.state.chunks.unshift(nch);
        return;
      } else if (nch.y >= this.state.chunks[this.state.chunks.length - 1].y) {
        this.state.chunks.push(nch);
        return;
      } else {
        for (let j = 0; j < this.state.chunks.length - 1; j++) {
          if (this.state.chunks[j].y <= nch.y && nch.y <= this.state.chunks[j + 1].y) {
            this.state.chunks.splice(j + 1, 0, nch);
            return;
          }
        }
      }
    }
  }

  /**
   * Load chunks for a given x range
   */
  chunkLoader(xmin: number, xmax: number): void {
    while (xmax > this.state.xmax - this.state.cwid || xmin < this.state.xmin + this.state.cwid) {
      let plan: PlanItem[];
      if (xmax > this.state.xmax - this.state.cwid) {
        plan = MountPlanner.plan(
          this.state.xmax,
          this.state.xmax + this.state.cwid,
          this.state.planmtx,
          this.state.landRegistry,
        );
        this.state.xmax = this.state.xmax + this.state.cwid;
      } else {
        plan = MountPlanner.plan(
          this.state.xmin - this.state.cwid,
          this.state.xmin,
          this.state.planmtx,
          this.state.landRegistry,
        );
        this.state.xmin = this.state.xmin - this.state.cwid;
      }

      for (let i = 0; i < plan.length; i++) {
        if (plan[i].tag === "mount") {
          this.addChunk({
            tag: plan[i].tag,
            x: plan[i].x,
            y: plan[i].y,
            canv: Mount.mountain(plan[i].x, plan[i].y, i * 2 * prng.random()),
          });
          this.addChunk({
            tag: plan[i].tag,
            x: plan[i].x,
            y: plan[i].y - 10000,
            canv: water(plan[i].x, plan[i].y, i * 2),
          });
        } else if (plan[i].tag === "flatmount") {
          this.addChunk({
            tag: plan[i].tag,
            x: plan[i].x,
            y: plan[i].y,
            canv: Mount.flatMount(plan[i].x, plan[i].y, 2 * prng.random() * Math.PI, {
              wid: 600 + prng.random() * 400,
              hei: 100,
              cho: 0.5 + prng.random() * 0.2,
            }),
          });
        } else if (plan[i].tag === "distmount") {
          this.addChunk({
            tag: plan[i].tag,
            x: plan[i].x,
            y: plan[i].y,
            canv: Mount.distMount(plan[i].x, plan[i].y, prng.random() * 100, {
              hei: 150,
              len: randChoice([500, 1000, 1500]),
            }),
          });
        } else if (plan[i].tag === "boat") {
          this.addChunk({
            tag: plan[i].tag,
            x: plan[i].x,
            y: plan[i].y,
            canv: Arch.boat01(plan[i].x, plan[i].y, prng.random(), {
              sca: plan[i].y / 800,
              fli: randChoice([true, false]),
            }),
          });
        } else if (plan[i].tag === "arch01") {
          // Simple house/building
          this.addChunk({
            tag: plan[i].tag,
            x: plan[i].x,
            y: plan[i].y,
            canv: Arch.arch01(plan[i].x, plan[i].y, prng.random() * 1000, {
              hei: 60 + prng.random() * 40,
              wid: 80 + prng.random() * 40,
              per: 3 + prng.random() * 2,
            }),
          });
        } else if (plan[i].tag === "arch02") {
          // Multi-story building
          this.addChunk({
            tag: plan[i].tag,
            x: plan[i].x,
            y: plan[i].y,
            canv: Arch.arch02(plan[i].x, plan[i].y, prng.random() * 1000, {
              wid: 40 + prng.random() * 30,
              sto: 2 + Math.floor(prng.random() * 3),
            }),
          });
        } else if (plan[i].tag === "arch03") {
          // Pagoda
          this.addChunk({
            tag: plan[i].tag,
            x: plan[i].x,
            y: plan[i].y,
            canv: Arch.arch03(plan[i].x, plan[i].y, prng.random() * 1000, {
              wid: 40 + prng.random() * 30,
              sto: 5 + Math.floor(prng.random() * 4),
            }),
          });
        } else if (plan[i].tag === "arch04") {
          // Transparent multi-story
          this.addChunk({
            tag: plan[i].tag,
            x: plan[i].x,
            y: plan[i].y,
            canv: Arch.arch04(plan[i].x, plan[i].y, prng.random() * 1000, {
              sto: 1 + Math.floor(prng.random() * 3),
            }),
          });
        } else if (plan[i].tag === "tower") {
          // Transmission tower
          this.addChunk({
            tag: plan[i].tag,
            x: plan[i].x,
            y: plan[i].y,
            canv: Arch.transmissionTower01(plan[i].x, plan[i].y, prng.random() * 1000, {
              hei: 150 + prng.random() * 100,
            }),
          });
        } else if (plan[i].tag === "redcirc") {
          this.addChunk({
            tag: plan[i].tag,
            x: plan[i].x,
            y: plan[i].y,
            canv: `<circle cx='${plan[i].x}' cy='${plan[i].y}' r='20' stroke='black' fill='red' />`,
          });
        } else if (plan[i].tag === "greencirc") {
          this.addChunk({
            tag: plan[i].tag,
            x: plan[i].x,
            y: plan[i].y,
            canv: `<circle cx='${plan[i].x}' cy='${plan[i].y}' r='20' stroke='black' fill='green' />`,
          });
        }
      }
    }
  }

  /**
   * Remove chunks that are far from the viewport to prevent memory leaks
   */
  private cleanupDistantChunks(xmin: number, xmax: number): void {
    const maxDistance = this.state.cwid * 10; // Keep chunks within 10 chunk widths (~5120px)

    this.state.chunks = this.state.chunks.filter((chunk) => {
      return chunk.x > xmin - maxDistance && chunk.x < xmax + maxDistance;
    });
  }

  /**
   * Render visible chunks for a given x range
   */
  chunkRender(xmin: number, xmax: number): void {
    this.state.canv = "";

    // Only render chunks that are actually visible (with minimal margin)
    // Reduce margin from cwid (512) to smaller value to limit DOM nodes
    const margin = 100;

    for (let i = 0; i < this.state.chunks.length; i++) {
      if (xmin - margin < this.state.chunks[i].x && this.state.chunks[i].x < xmax + margin) {
        this.state.canv += this.state.chunks[i].canv;
      }
    }
  }

  /**
   * Calculate viewBox for SVG
   */
  calcViewBox(): string {
    const zoom = 1.142;
    return `${this.state.cursx} 0 ${this.state.windx / zoom} ${this.state.windy / zoom}`;
  }

  /**
   * Check if scene needs updating
   */
  needUpdate(): boolean {
    // Only update if viewport is approaching the edge of loaded chunks
    if (
      this.state.xmin < this.state.cursx &&
      this.state.cursx < this.state.xmax - this.state.windx
    ) {
      return false;
    }
    return true;
  }

  /**
   * Update the scene - load and render chunks
   */
  update(): void {
    this.chunkLoader(this.state.cursx, this.state.cursx + this.state.windx);
    this.cleanupDistantChunks(this.state.cursx, this.state.cursx + this.state.windx);
    this.chunkRender(this.state.cursx, this.state.cursx + this.state.windx);
    this.contentDirty = true; // Mark content as changed
  }

  /**
   * Scroll the viewport horizontally
   */
  scroll(delta: number): void {
    this.state.cursx += delta;
    if (this.needUpdate()) {
      this.update();
    }
  }

  /**
   * Set viewport position without triggering update
   * Used for smooth scrolling animation
   */
  setViewportX(x: number): void {
    this.state.cursx = x;
  }

  /**
   * Get the rendered SVG content
   */
  getCanvas(): string {
    return this.state.canv;
  }

  /**
   * Get full SVG with wrapper
   */
  getSVG(): string {
    return `<svg id='SVG' xmlns='http://www.w3.org/2000/svg' width='${this.state.windx}' height='${this.state.windy}' style='mix-blend-mode:multiply;' viewBox='${this.calcViewBox()}'><g id='G' transform='translate(0,0)'>${this.state.canv}</g></svg>`;
  }

  /**
   * Check if content has changed (new chunks loaded)
   */
  isContentDirty(): boolean {
    return this.contentDirty;
  }

  /**
   * Mark content as clean (used after rendering)
   */
  markContentClean(): void {
    this.contentDirty = false;
  }
}
