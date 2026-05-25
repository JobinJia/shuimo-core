import { bench, describe, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { generateSealAsync } from "./seal";
import { generateStampAsync } from "../Stamp";

let fontBuf: ArrayBuffer;

beforeAll(() => {
  const p = resolve(process.cwd(), "../../playground/public/fonts/yishanbeizhuanti.demo.woff2");
  const node = readFileSync(p);
  fontBuf = node.buffer.slice(node.byteOffset, node.byteOffset + node.byteLength) as ArrayBuffer;
});

// `time` budgets each bench to ~1s so noisy single-call timings get enough
// samples. Default 500ms gives <5 samples for ~200ms work which is unstable.
const BENCH_TIME = 1500;

describe("single stamp (warm cache)", () => {
  bench(
    "v1 generateStampAsync",
    async () => {
      await generateStampAsync({
        text: ["水墨"],
        fontData: fontBuf,
        seed: 42,
      });
    },
    { time: BENCH_TIME },
  );

  bench(
    "v2 generateSealAsync",
    async () => {
      await generateSealAsync({
        text: "水墨",
        font: fontBuf,
        seed: 42,
        size: 200,
      });
    },
    { time: BENCH_TIME },
  );
});

describe("multi-stamp × 50 different seeds (worst case: no dedup)", () => {
  bench(
    "v1 × 50",
    async () => {
      for (let i = 0; i < 50; i++) {
        await generateStampAsync({ text: ["水墨"], fontData: fontBuf, seed: i });
      }
    },
    { time: BENCH_TIME },
  );

  bench(
    "v2 × 50",
    async () => {
      for (let i = 0; i < 50; i++) {
        await generateSealAsync({ text: "水墨", font: fontBuf, seed: i, size: 200 });
      }
    },
    { time: BENCH_TIME },
  );
});

describe("multi-stamp × 50 identical (best case: cache friendly)", () => {
  bench(
    "v1 × 50 identical",
    async () => {
      for (let i = 0; i < 50; i++) {
        await generateStampAsync({ text: ["水墨"], fontData: fontBuf, seed: 42 });
      }
    },
    { time: BENCH_TIME },
  );

  bench(
    "v2 × 50 identical",
    async () => {
      for (let i = 0; i < 50; i++) {
        await generateSealAsync({ text: "水墨", font: fontBuf, seed: 42, size: 200 });
      }
    },
    { time: BENCH_TIME },
  );
});

describe("text complexity (10 chars, multi-column)", () => {
  bench(
    "v1 long text",
    async () => {
      await generateStampAsync({
        text: ["落梅听风", "山高水长", "无尽时"],
        fontData: fontBuf,
        seed: 7,
      });
    },
    { time: BENCH_TIME },
  );

  bench(
    "v2 long text",
    async () => {
      await generateSealAsync({
        text: ["落梅听风", "山高水长", "无尽时"],
        font: fontBuf,
        seed: 7,
        size: 200,
      });
    },
    { time: BENCH_TIME },
  );
});
