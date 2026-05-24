/* @ts-self-types="./shuimo_noise.d.ts" */

/**
 * Gabor noise (anisotropic fiber texture) — single sample.
 * @param {number} seed
 * @param {number} x
 * @param {number} y
 * @param {number} kernel_radius
 * @returns {number}
 */
export function shuimo_gabor2d(seed, x, y, kernel_radius) {
  const ret = wasm.shuimo_gabor2d(seed, x, y, kernel_radius);
  return ret;
}

/**
 * Gabor noise batch.
 * @param {number} seed
 * @param {Float64Array} xs
 * @param {Float64Array} ys
 * @param {number} kernel_radius
 * @param {Float64Array} out
 */
export function shuimo_gabor2d_batch(seed, xs, ys, kernel_radius, out) {
  const ptr0 = passArrayF64ToWasm0(xs, wasm.__wbindgen_export);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArrayF64ToWasm0(ys, wasm.__wbindgen_export);
  const len1 = WASM_VECTOR_LEN;
  var ptr2 = passArrayF64ToWasm0(out, wasm.__wbindgen_export);
  var len2 = WASM_VECTOR_LEN;
  wasm.shuimo_gabor2d_batch(
    seed,
    ptr0,
    len0,
    ptr1,
    len1,
    kernel_radius,
    ptr2,
    len2,
    addHeapObject(out),
  );
}

/**
 * Initialize noise engines from a seed. Must be called before sampling.
 * @param {number} perlin_seed
 * @param {number} worley_seed
 * @param {number} octaves
 * @param {number} falloff
 */
export function shuimo_noise_init(perlin_seed, worley_seed, octaves, falloff) {
  wasm.shuimo_noise_init(perlin_seed, worley_seed, octaves, falloff);
}

/**
 * Single 2D Perlin noise sample.
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function shuimo_perlin2d(x, y) {
  const ret = wasm.shuimo_perlin2d(x, y);
  return ret;
}

/**
 * Batch 2D Perlin noise. wasm-bindgen auto-copies slices from JS.
 * @param {Float64Array} xs
 * @param {Float64Array} ys
 * @param {Float64Array} out
 */
export function shuimo_perlin2d_batch(xs, ys, out) {
  const ptr0 = passArrayF64ToWasm0(xs, wasm.__wbindgen_export);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArrayF64ToWasm0(ys, wasm.__wbindgen_export);
  const len1 = WASM_VECTOR_LEN;
  var ptr2 = passArrayF64ToWasm0(out, wasm.__wbindgen_export);
  var len2 = WASM_VECTOR_LEN;
  wasm.shuimo_perlin2d_batch(ptr0, len0, ptr1, len1, ptr2, len2, addHeapObject(out));
}

/**
 * Single 3D Perlin noise sample.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {number}
 */
export function shuimo_perlin3d(x, y, z) {
  const ret = wasm.shuimo_perlin3d(x, y, z);
  return ret;
}

/**
 * Batch 3D Perlin noise.
 * @param {Float64Array} xs
 * @param {Float64Array} ys
 * @param {Float64Array} zs
 * @param {Float64Array} out
 */
export function shuimo_perlin3d_batch(xs, ys, zs, out) {
  const ptr0 = passArrayF64ToWasm0(xs, wasm.__wbindgen_export);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArrayF64ToWasm0(ys, wasm.__wbindgen_export);
  const len1 = WASM_VECTOR_LEN;
  const ptr2 = passArrayF64ToWasm0(zs, wasm.__wbindgen_export);
  const len2 = WASM_VECTOR_LEN;
  var ptr3 = passArrayF64ToWasm0(out, wasm.__wbindgen_export);
  var len3 = WASM_VECTOR_LEN;
  wasm.shuimo_perlin3d_batch(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, addHeapObject(out));
}

/**
 * Initialize Perlin from an explicit table — matches shan-shui-inf's JS
 * PerlinNoise lazy init (table filled by sequential prng.random() calls,
 * not by an internal LCG from a single seed). Leaves Worley untouched.
 * @param {Float64Array} table
 * @param {number} octaves
 * @param {number} falloff
 */
export function shuimo_perlin_init_from_table(table, octaves, falloff) {
  const ptr0 = passArrayF64ToWasm0(table, wasm.__wbindgen_export);
  const len0 = WASM_VECTOR_LEN;
  wasm.shuimo_perlin_init_from_table(ptr0, len0, octaves, falloff);
}

/**
 * Update Perlin octaves/falloff without rebuilding the table.
 * @param {number} octaves
 * @param {number} falloff
 */
export function shuimo_perlin_set_detail(octaves, falloff) {
  wasm.shuimo_perlin_set_detail(octaves, falloff);
}

/**
 * Single Worley noise sample.
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function shuimo_worley2d(x, y) {
  const ret = wasm.shuimo_worley2d(x, y);
  return ret;
}

/**
 * Worley edge noise (F2 - F1).
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function shuimo_worley_edge2d(x, y) {
  const ret = wasm.shuimo_worley_edge2d(x, y);
  return ret;
}

/**
 * Worley fBm (multi-octave).
 * @param {number} x
 * @param {number} y
 * @param {number} octaves
 * @param {number} lacunarity
 * @param {number} gain
 * @returns {number}
 */
export function shuimo_worley_fbm2d(x, y, octaves, lacunarity, gain) {
  const ret = wasm.shuimo_worley_fbm2d(x, y, octaves, lacunarity, gain);
  return ret;
}

/**
 * @param {number} radius
 * @param {number} border_points
 * @param {number} noise_amount
 * @param {number} seed
 * @param {boolean} regular
 * @param {number} noise_octaves
 * @param {number} noise_falloff
 * @param {number} noise_density
 * @returns {string}
 */
export function stamp_circle_path(
  radius,
  border_points,
  noise_amount,
  seed,
  regular,
  noise_octaves,
  noise_falloff,
  noise_density,
) {
  let deferred1_0;
  let deferred1_1;
  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    wasm.stamp_circle_path(
      retptr,
      radius,
      border_points,
      noise_amount,
      seed,
      regular,
      noise_octaves,
      noise_falloff,
      noise_density,
    );
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    deferred1_0 = r0;
    deferred1_1 = r1;
    return getStringFromWasm0(r0, r1);
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
    wasm.__wbindgen_export2(deferred1_0, deferred1_1, 1);
  }
}

/**
 * @param {number} w
 * @param {number} h
 * @param {number} border_points
 * @param {number} noise_amount
 * @param {number} seed
 * @param {boolean} regular
 * @param {number} noise_octaves
 * @param {number} noise_falloff
 * @param {number} noise_density
 * @returns {string}
 */
export function stamp_ellipse_path(
  w,
  h,
  border_points,
  noise_amount,
  seed,
  regular,
  noise_octaves,
  noise_falloff,
  noise_density,
) {
  let deferred1_0;
  let deferred1_1;
  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    wasm.stamp_ellipse_path(
      retptr,
      w,
      h,
      border_points,
      noise_amount,
      seed,
      regular,
      noise_octaves,
      noise_falloff,
      noise_density,
    );
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    deferred1_0 = r0;
    deferred1_1 = r1;
    return getStringFromWasm0(r0, r1);
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
    wasm.__wbindgen_export2(deferred1_0, deferred1_1, 1);
  }
}

/**
 * @param {number} w
 * @param {number} h
 * @param {number} border_points
 * @param {number} corner_radius
 * @param {number} noise_amount
 * @param {number} seed
 * @param {boolean} regular
 * @param {number} noise_octaves
 * @param {number} noise_falloff
 * @param {number} noise_density
 * @returns {string}
 */
export function stamp_rect_path(
  w,
  h,
  border_points,
  corner_radius,
  noise_amount,
  seed,
  regular,
  noise_octaves,
  noise_falloff,
  noise_density,
) {
  let deferred1_0;
  let deferred1_1;
  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    wasm.stamp_rect_path(
      retptr,
      w,
      h,
      border_points,
      corner_radius,
      noise_amount,
      seed,
      regular,
      noise_octaves,
      noise_falloff,
      noise_density,
    );
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    deferred1_0 = r0;
    deferred1_1 = r1;
    return getStringFromWasm0(r0, r1);
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
    wasm.__wbindgen_export2(deferred1_0, deferred1_1, 1);
  }
}

/**
 * @param {number} size
 * @param {number} border_points
 * @param {number} corner_radius
 * @param {number} noise_amount
 * @param {number} seed
 * @param {boolean} regular
 * @param {number} noise_octaves
 * @param {number} noise_falloff
 * @param {number} noise_density
 * @returns {string}
 */
export function stamp_square_path(
  size,
  border_points,
  corner_radius,
  noise_amount,
  seed,
  regular,
  noise_octaves,
  noise_falloff,
  noise_density,
) {
  let deferred1_0;
  let deferred1_1;
  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    wasm.stamp_square_path(
      retptr,
      size,
      border_points,
      corner_radius,
      noise_amount,
      seed,
      regular,
      noise_octaves,
      noise_falloff,
      noise_density,
    );
    var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
    var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
    deferred1_0 = r0;
    deferred1_1 = r1;
    return getStringFromWasm0(r0, r1);
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
    wasm.__wbindgen_export2(deferred1_0, deferred1_1, 1);
  }
}
function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg___wbindgen_copy_to_typed_array_787746aeb47818bc: function (arg0, arg1, arg2) {
      new Uint8Array(
        getObject(arg2).buffer,
        getObject(arg2).byteOffset,
        getObject(arg2).byteLength,
      ).set(getArrayU8FromWasm0(arg0, arg1));
    },
    __wbindgen_object_drop_ref: function (arg0) {
      takeObject(arg0);
    },
  };
  return {
    __proto__: null,
    "./shuimo_noise_bg.js": import0,
  };
}

function addHeapObject(obj) {
  if (heap_next === heap.length) heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];

  heap[idx] = obj;
  return idx;
}

function dropObject(idx) {
  if (idx < 1028) return;
  heap[idx] = heap_next;
  heap_next = idx;
}

function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
  if (
    cachedDataViewMemory0 === null ||
    cachedDataViewMemory0.buffer.detached === true ||
    (cachedDataViewMemory0.buffer.detached === undefined &&
      cachedDataViewMemory0.buffer !== wasm.memory.buffer)
  ) {
    cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
  }
  return cachedDataViewMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
  if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
    cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
  }
  return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
  return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

function getObject(idx) {
  return heap[idx];
}

let heap = new Array(1024).fill(undefined);
heap.push(undefined, null, true, false);

let heap_next = heap.length;

function passArrayF64ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 8, 8) >>> 0;
  getFloat64ArrayMemory0().set(arg, ptr / 8);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}

let cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
  wasmInstance = instance;
  wasm = instance.exports;
  wasmModule = module;
  cachedDataViewMemory0 = null;
  cachedFloat64ArrayMemory0 = null;
  cachedUint8ArrayMemory0 = null;
  return wasm;
}

async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = module.ok && expectedResponseType(module.type);

        if (validResponse && module.headers.get("Content-Type") !== "application/wasm") {
          console.warn(
            "`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",
            e,
          );
        } else {
          throw e;
        }
      }
    }

    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);

    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }

  function expectedResponseType(type) {
    switch (type) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}

function initSync(module) {
  if (wasm !== undefined) return wasm;

  if (module !== undefined) {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ({ module } = module);
    } else {
      console.warn("using deprecated parameters for `initSync()`; pass a single object instead");
    }
  }

  const imports = __wbg_get_imports();
  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module);
  }
  const instance = new WebAssembly.Instance(module, imports);
  return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
  if (wasm !== undefined) return wasm;

  if (module_or_path !== undefined) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn(
        "using deprecated parameters for the initialization function; pass a single object instead",
      );
    }
  }

  if (module_or_path === undefined) {
    module_or_path = new URL("shuimo_noise_bg.wasm", import.meta.url);
  }
  const imports = __wbg_get_imports();

  if (
    typeof module_or_path === "string" ||
    (typeof Request === "function" && module_or_path instanceof Request) ||
    (typeof URL === "function" && module_or_path instanceof URL)
  ) {
    module_or_path = fetch(module_or_path);
  }

  const { instance, module } = await __wbg_load(await module_or_path, imports);

  return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
