// Minimal synchronous PNG encoder (8-bit RGB, zlib "stored" blocks, no
// compression). Used to embed the SVG paper's small low-frequency tone raster
// as a data URI without depending on canvas, zlib or async CompressionStream.

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }
  }
  return crcTable;
}

function crc32(bytes: Uint8Array, start: number, end: number): number {
  const table = getCrcTable();
  let c = 0xffffffff;
  for (let i = start; i < end; i++) {
    c = table[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeU32(out: Uint8Array, offset: number, value: number): void {
  out[offset] = (value >>> 24) & 0xff;
  out[offset + 1] = (value >>> 16) & 0xff;
  out[offset + 2] = (value >>> 8) & 0xff;
  out[offset + 3] = value & 0xff;
}

/** Encodes `rgb` (width × height × 3 bytes) as a PNG file. */
export function encodePngRgb(rgb: Uint8Array, width: number, height: number): Uint8Array {
  const rowLen = width * 3 + 1;
  const raw = new Uint8Array(rowLen * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowLen] = 0; // filter: none
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * rowLen + 1);
  }

  // zlib stream of stored blocks (≤ 65535 bytes each).
  const blockCount = Math.max(1, Math.ceil(raw.length / 65535));
  const zlibLen = 2 + raw.length + blockCount * 5 + 4;
  const zlib = new Uint8Array(zlibLen);
  zlib[0] = 0x78;
  zlib[1] = 0x01;
  let o = 2;
  for (let b = 0; b < blockCount; b++) {
    const start = b * 65535;
    const len = Math.min(65535, raw.length - start);
    zlib[o++] = b === blockCount - 1 ? 1 : 0;
    zlib[o++] = len & 0xff;
    zlib[o++] = (len >>> 8) & 0xff;
    zlib[o++] = ~len & 0xff;
    zlib[o++] = (~len >>> 8) & 0xff;
    zlib.set(raw.subarray(start, start + len), o);
    o += len;
  }
  let a = 1;
  let bsum = 0;
  for (let i = 0; i < raw.length; i++) {
    a = (a + raw[i]!) % 65521;
    bsum = (bsum + a) % 65521;
  }
  writeU32(zlib, o, ((bsum << 16) | a) >>> 0);

  const chunks: Array<[string, Uint8Array]> = [];
  const ihdr = new Uint8Array(13);
  writeU32(ihdr, 0, width);
  writeU32(ihdr, 4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  chunks.push(["IHDR", ihdr], ["IDAT", zlib], ["IEND", new Uint8Array(0)]);

  const total = 8 + chunks.reduce((sum, [, data]) => sum + 12 + data.length, 0);
  const out = new Uint8Array(total);
  out.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  let p = 8;
  for (const [type, data] of chunks) {
    writeU32(out, p, data.length);
    for (let i = 0; i < 4; i++) out[p + 4 + i] = type.charCodeAt(i);
    out.set(data, p + 8);
    writeU32(out, p + 8 + data.length, crc32(out, p + 4, p + 8 + data.length));
    p += 12 + data.length;
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
