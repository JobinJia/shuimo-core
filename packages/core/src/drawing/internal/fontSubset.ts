/**
 * Runtime font subsetting via harfbuzz-subset.wasm.
 *
 * Used when a primary stamp font (typically a subset woff2) is missing a
 * codepoint and a fallback URL is provided: load the full font once, harfbuzz
 * subset down to just the chars used by this stamp, hand the mini font to
 * the existing fontkit pipeline.
 *
 * Accepts TTF/OTF input only — harfbuzz-subset.wasm does not include brotli/
 * zlib decompression, so WOFF/WOFF2 fallback fonts must be converted server-
 * side or via a separate decoder before being supplied to this module.
 *
 * The wasm module is fetched lazily on first call and cached process-wide,
 * so the cost is paid only once per session, only when fallback is needed.
 */

interface HarfbuzzSubsetExports {
  memory: WebAssembly.Memory;
  malloc(size: number): number;
  free(ptr: number): void;
  hb_blob_create(
    data: number,
    length: number,
    mode: number,
    userData: number,
    destroy: number,
  ): number;
  hb_blob_destroy(blob: number): void;
  hb_blob_get_data(blob: number, length: number): number;
  hb_blob_get_length(blob: number): number;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_reference_blob(face: number): number;
  hb_subset_input_create_or_fail(): number;
  hb_subset_input_destroy(input: number): void;
  hb_subset_input_unicode_set(input: number): number;
  hb_subset_or_fail(face: number, input: number): number;
  hb_set_add(set: number, codepoint: number): void;
}

const HB_MEMORY_MODE_READONLY = 1;

let wasmInstancePromise: Promise<HarfbuzzSubsetExports> | null = null;
let configuredWasmSource: WasmSource | undefined;

/** Anything we can instantiate the harfbuzz-subset wasm from. */
export type WasmSource = string | ArrayBuffer | Uint8Array | WebAssembly.Module;

export interface SubsetOptions {
  /**
   * Where to load harfbuzz-subset.wasm from. Required on first call per
   * process. A URL string is fetched on demand; an ArrayBuffer / Uint8Array
   * is instantiated directly; a compiled WebAssembly.Module is reused as-is
   * (useful when sharing across workers).
   *
   * Common sources for the URL form:
   *   - Vite/webpack:  `import wasmUrl from "harfbuzzjs/dist/harfbuzz-subset.wasm?url"`
   *   - Static host:   the file copied into your public assets
   */
  wasmUrl?: WasmSource;
}

/**
 * Globally configure where harfbuzz-subset.wasm comes from so callers don't
 * have to pass it on every stamp. Idempotent — first call wins; subsequent
 * calls with a different source are ignored once the wasm has been
 * instantiated.
 */
export function configureFontSubsetWasm(source: WasmSource): void {
  configuredWasmSource = source;
}

function isBufferLike(value: unknown): value is ArrayBuffer | ArrayBufferView {
  // Avoid `instanceof ArrayBuffer` — that fails across realms (jsdom vs Node).
  if (value == null || typeof value !== "object") return false;
  if (ArrayBuffer.isView(value)) return true;
  // Duck-type by checking for ArrayBuffer's distinctive properties.
  const v = value as { byteLength?: unknown; slice?: unknown; constructor?: { name?: string } };
  if (typeof v.byteLength !== "number" || typeof v.slice !== "function") return false;
  const name = v.constructor?.name;
  return name === "ArrayBuffer" || name === "SharedArrayBuffer";
}

function toArrayBuffer(source: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (ArrayBuffer.isView(source)) {
    // Copy out of the view's region to a fresh ArrayBuffer. Works regardless
    // of whether the underlying buffer is ArrayBuffer or SharedArrayBuffer.
    const out = new ArrayBuffer(source.byteLength);
    new Uint8Array(out).set(new Uint8Array(source.buffer, source.byteOffset, source.byteLength));
    return out;
  }
  return source as ArrayBuffer;
}

async function instantiateWasm(source: WasmSource): Promise<HarfbuzzSubsetExports> {
  let instance: WebAssembly.Instance;
  if (source instanceof WebAssembly.Module) {
    // instantiate(Module) returns Instance directly, not WebAssemblyInstantiatedSource.
    instance = await WebAssembly.instantiate(source, {});
  } else if (isBufferLike(source)) {
    const result = await WebAssembly.instantiate(toArrayBuffer(source), {});
    instance = result.instance;
  } else {
    const url = source;
    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      throw new Error(
        `font-subset: failed to fetch ${url} (${err instanceof Error ? err.message : String(err)})`,
      );
    }
    if (!response.ok) {
      throw new Error(`font-subset: failed to fetch ${url} (status ${response.status})`);
    }
    // Some hosts (file://, S3 with wrong content-type) reject instantiateStreaming
    // because of MIME mismatch. Fall back to ArrayBuffer-based instantiate.
    const cloned = response.clone();
    try {
      instance = (await WebAssembly.instantiateStreaming(response, {})).instance;
    } catch {
      const buffer = await cloned.arrayBuffer();
      instance = (await WebAssembly.instantiate(buffer, {})).instance;
    }
  }
  return instance.exports as unknown as HarfbuzzSubsetExports;
}

async function loadHarfbuzz(source: WasmSource): Promise<HarfbuzzSubsetExports> {
  if (!wasmInstancePromise) {
    wasmInstancePromise = instantiateWasm(source).catch((err) => {
      // Allow retry on next call if init failed.
      wasmInstancePromise = null;
      throw err;
    });
  }
  return wasmInstancePromise;
}

function collectCodepoints(chars: string[]): number[] {
  const set = new Set<number>();
  for (const line of chars) {
    for (const ch of Array.from(line)) {
      const cp = ch.codePointAt(0);
      if (cp != null) set.add(cp);
    }
  }
  return [...set];
}

/**
 * Subset a TTF/OTF font down to the given characters. Returns a mini TTF
 * buffer suitable for fontkit (typically 2-8 KB for a handful of CJK chars).
 */
export async function subsetFontBuffer(
  buffer: ArrayBuffer,
  chars: string[],
  opts: SubsetOptions = {},
): Promise<ArrayBuffer> {
  const codepoints = collectCodepoints(chars);
  if (codepoints.length === 0) {
    throw new Error("font-subset: no codepoints to subset");
  }

  const resolvedSource = opts.wasmUrl ?? configuredWasmSource;
  if (resolvedSource == null) {
    throw new Error(
      "font-subset: harfbuzz-subset.wasm is not configured. " +
        "Call configureFontSubsetWasm(source) once at startup, or pass " +
        "harfbuzzSubsetWasmUrl in StampOptions. The wasm file ships with the " +
        "harfbuzzjs npm package at harfbuzzjs/dist/harfbuzz-subset.wasm.",
    );
  }
  const hb = await loadHarfbuzz(resolvedSource);
  const length = buffer.byteLength;
  const ptr = hb.malloc(length);
  if (ptr === 0) throw new Error("font-subset: wasm malloc failed");

  // wasm memory may grow during allocation; always re-derive the heap view.
  let heap = new Uint8Array(hb.memory.buffer);
  heap.set(new Uint8Array(buffer), ptr);

  const blob = hb.hb_blob_create(ptr, length, HB_MEMORY_MODE_READONLY, 0, 0);
  const face = hb.hb_face_create(blob, 0);
  hb.hb_blob_destroy(blob);

  const input = hb.hb_subset_input_create_or_fail();
  if (input === 0) {
    hb.hb_face_destroy(face);
    hb.free(ptr);
    throw new Error("font-subset: hb_subset_input_create_or_fail returned 0");
  }

  const unicodes = hb.hb_subset_input_unicode_set(input);
  for (const cp of codepoints) hb.hb_set_add(unicodes, cp);

  const subsetFace = hb.hb_subset_or_fail(face, input);
  hb.hb_subset_input_destroy(input);
  hb.hb_face_destroy(face);
  hb.free(ptr);
  if (subsetFace === 0) {
    throw new Error(
      "font-subset: hb_subset_or_fail returned 0 (corrupt input or unsupported format)",
    );
  }

  const result = hb.hb_face_reference_blob(subsetFace);
  heap = new Uint8Array(hb.memory.buffer);
  const offset = hb.hb_blob_get_data(result, 0);
  const subsetLength = hb.hb_blob_get_length(result);
  // .slice() copies into a fresh ArrayBuffer detached from wasm memory.
  const subsetBytes = heap.slice(offset, offset + subsetLength);

  hb.hb_blob_destroy(result);
  hb.hb_face_destroy(subsetFace);

  return subsetBytes.buffer;
}
