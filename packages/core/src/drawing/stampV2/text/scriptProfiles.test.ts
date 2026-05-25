import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateSeal } from "../seal";
import { getScriptProfile } from "./scriptProfiles";

let fontBuf: ArrayBuffer;

beforeAll(() => {
  const path = resolve(process.cwd(), "../../playground/public/fonts/yishanbeizhuanti.demo.woff2");
  const node = readFileSync(path);
  fontBuf = node.buffer.slice(node.byteOffset, node.byteOffset + node.byteLength) as ArrayBuffer;
});

describe("getScriptProfile", () => {
  it("returns null for undefined script", () => {
    expect(getScriptProfile(undefined)).toBeNull();
  });

  it("monotonic intensity: jinwen < dazhuan < xiaozhuan < jiudiezhuan", () => {
    const jw = getScriptProfile("jinwen")!.intensity;
    const dz = getScriptProfile("dazhuan")!.intensity;
    const xz = getScriptProfile("xiaozhuan")!.intensity;
    const jdz = getScriptProfile("jiudiezhuan")!.intensity;
    expect(jw).toBeLessThan(dz);
    expect(dz).toBeLessThan(xz);
    expect(xz).toBeLessThan(jdz);
  });

  it("jiudiezhuan auto-stretches; others do not", () => {
    expect(getScriptProfile("jiudiezhuan")!.autoStretch).toBe(true);
    expect(getScriptProfile("xiaozhuan")!.autoStretch).toBe(false);
    expect(getScriptProfile("jinwen")!.autoStretch).toBe(false);
    expect(getScriptProfile("custom")!.autoStretch).toBe(false);
  });

  it("custom profile has zero baseline intensity", () => {
    expect(getScriptProfile("custom")!.intensity).toBe(0);
  });
});

describe("generateSeal with script", () => {
  it("different scripts produce different SVG (geometry varies)", () => {
    const opts = { text: "水墨", size: 200, seed: 42, font: fontBuf };
    const jinwen = generateSeal({ ...opts, script: "jinwen" as const });
    const xz = generateSeal({ ...opts, script: "xiaozhuan" as const });
    const jdz = generateSeal({ ...opts, script: "jiudiezhuan" as const });
    expect(jinwen.svg).not.toBe(xz.svg);
    expect(xz.svg).not.toBe(jdz.svg);
  });

  it("explicit carving.intensity overrides script's baseline", () => {
    const opts = { text: "水墨", size: 200, seed: 42, font: fontBuf };
    // script=jinwen has intensity 0.3 default; with carving=1.0 the output
    // should match xiaozhuan-or-stronger angularity (any case, same as
    // running script=jinwen without baseline should look more carved).
    const jinwenDefault = generateSeal({ ...opts, script: "jinwen" as const });
    const jinwenOverride = generateSeal({
      ...opts,
      script: "jinwen" as const,
      carving: { intensity: 1.0 },
    });
    expect(jinwenDefault.svg).not.toBe(jinwenOverride.svg);
  });

  it("jiudiezhuan enables stretch by default (cells fill non-uniformly)", () => {
    const opts = { text: "水墨听风", size: 200, seed: 42, font: fontBuf };
    const jdz = generateSeal({ ...opts, script: "jiudiezhuan" as const });
    // Auto-stretch path emits per-cell clipPath elements
    expect(jdz.svg).toContain("clipPath");
  });

  it("explicit layout.stretch=false overrides jiudiezhuan auto-stretch", () => {
    const opts = { text: "水墨听风", size: 200, seed: 42, font: fontBuf };
    const auto = generateSeal({ ...opts, script: "jiudiezhuan" as const });
    const off = generateSeal({
      ...opts,
      script: "jiudiezhuan" as const,
      layout: { stretch: false },
    });
    expect(auto.svg).not.toBe(off.svg);
  });
});
