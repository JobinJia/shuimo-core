//! Xuan paper tone pass.
//!
//! Produces the paper's base pixel buffer (base colour + formation cloudiness +
//! grain + ageing + deckle alpha) directly in WASM memory. The JS side wraps
//! the returned pointer as the backing store of an `ImageData` and hands it to
//! `putImageData`, so no pixel buffer ever crosses the boundary.
//!
//! Each noise field is evaluated at a stride that matches its frequency and
//! bilinearly upsampled; only the two highest-frequency fields (fine formation
//! and micro grain) are evaluated per pixel. Grids are aligned to global pixel
//! coordinates so tiles rendered independently line up seamlessly.
//!
//! The JS fallback in `src/elements/natural/xuan-paper/tone-field.ts` mirrors
//! this file step by step; keep the two in sync.

use std::cell::RefCell;
use std::f64::consts::PI;

const PERLIN_YWRAPB: u32 = 4;
const PERLIN_YWRAP: usize = 1 << PERLIN_YWRAPB;
const PERLIN_SIZE: usize = 4095;
const TABLE_LEN: usize = PERLIN_SIZE + 1;

const COS_LUT_SIZE: usize = 1024;
const COS_LUT_LEN: usize = COS_LUT_SIZE + 1;

// Field frequencies (cycles per pixel of the first octave) and grid strides.
const TONE_FREQ: f64 = 0.004;
const TONE_STRIDE: usize = 16;
const FORM_LOW_FREQ: f64 = 0.018;
const FORM_LOW_STRIDE: usize = 4;
const FORM_MID_FREQ: f64 = 0.07;
const FORM_MID_STRIDE: usize = 2;
const FORM_HI_FREQ: f64 = 0.22;
const DETAIL_FREQ: f64 = 0.55;
const PATINA_FREQ: f64 = 0.006;
const PATINA_STRIDE: usize = 8;

// Mean of each octave sum, used to centre the fields on zero.
// sum_{i<n} 0.5 * falloff^i * 0.5
const TONE_MEAN: f64 = 0.5 * (0.5 + 0.25 + 0.125 + 0.0625);
const FORM_MEAN: f64 = 0.5 * (0.5 + 0.275 + 0.15125);
const FORM_HI_MEAN: f64 = 0.5 * (0.5 + 0.275);
const DETAIL_MEAN: f64 = 0.5 * (0.5 + 0.24);

// Weights of the three formation bands (sum to 1).
const FORM_LOW_W: f64 = 0.58;
const FORM_MID_W: f64 = 0.26;
const FORM_HI_W: f64 = 0.16;

struct Lut {
    cos: [f64; COS_LUT_LEN],
}

impl Lut {
    fn new() -> Self {
        let mut cos = [0.0f64; COS_LUT_LEN];
        for (i, item) in cos.iter_mut().enumerate() {
            *item = 0.5 * (1.0 - (i as f64 / COS_LUT_SIZE as f64 * PI).cos());
        }
        Self { cos }
    }

    #[inline(always)]
    fn scaled_cosine(&self, i: f64) -> f64 {
        let t = i * COS_LUT_SIZE as f64;
        let idx = t as usize;
        if idx >= COS_LUT_SIZE {
            return self.cos[COS_LUT_SIZE];
        }
        let frac = t - idx as f64;
        // SAFETY: idx < COS_LUT_SIZE, so idx + 1 < COS_LUT_LEN.
        let (c0, c1) = unsafe { (*self.cos.get_unchecked(idx), *self.cos.get_unchecked(idx + 1)) };
        c0 + frac * (c1 - c0)
    }
}

/// p5-style value noise with an f32 lattice table (16 KiB, L1 friendly).
struct ValueNoise {
    table: Box<[f32; TABLE_LEN]>,
}

impl ValueNoise {
    fn new(seed: i32) -> Self {
        let a: u32 = 1664525;
        let c: u32 = 1013904223;
        let mut z: u32 = seed as u32;
        let mut table = Box::new([0.0f32; TABLE_LEN]);
        for item in table.iter_mut() {
            z = a.wrapping_mul(z).wrapping_add(c);
            *item = (z as f64 / 4294967296.0) as f32;
        }
        Self { table }
    }

    #[inline(always)]
    fn noise2d(&self, lut: &Lut, x: f64, y: f64, octaves: u32, falloff: f64) -> f64 {
        let x = x.abs();
        let y = y.abs();
        let mut xi = x as i64;
        let mut yi = y as i64;
        let mut xf = x - xi as f64;
        let mut yf = y - yi as f64;
        let mut r = 0.0f64;
        let mut ampl = 0.5f64;
        let t = &self.table;

        for _ in 0..octaves {
            let of_val = (xi + (yi << PERLIN_YWRAPB)) as usize;
            let rxf = lut.scaled_cosine(xf);
            let ryf = lut.scaled_cosine(yf);

            // SAFETY: every index is masked with PERLIN_SIZE (< TABLE_LEN).
            let (v0, v1, v2, v3) = unsafe {
                (
                    *t.get_unchecked(of_val & PERLIN_SIZE) as f64,
                    *t.get_unchecked((of_val + 1) & PERLIN_SIZE) as f64,
                    *t.get_unchecked((of_val + PERLIN_YWRAP) & PERLIN_SIZE) as f64,
                    *t.get_unchecked((of_val + PERLIN_YWRAP + 1) & PERLIN_SIZE) as f64,
                )
            };

            let n1 = v0 + rxf * (v1 - v0);
            let n2 = v2 + rxf * (v3 - v2);
            r += (n1 + ryf * (n2 - n1)) * ampl;
            ampl *= falloff;

            xi <<= 1;
            xf *= 2.0;
            yi <<= 1;
            yf *= 2.0;
            if xf >= 1.0 {
                xi += 1;
                xf -= 1.0;
            }
            if yf >= 1.0 {
                yi += 1;
                yf -= 1.0;
            }
        }
        r
    }
}

/// Integer hash → two uniforms in [0, 1). Mirrors `hashPair` in tone-field.ts
/// (Math.imul semantics).
#[inline(always)]
fn hash_pair(x: i32, y: i32, seed: i32) -> (f64, f64) {
    let mut h = (x as u32)
        .wrapping_mul(374761393)
        .wrapping_add((y as u32).wrapping_mul(668265263))
        .wrapping_add((seed as u32).wrapping_mul(1274126177));
    h = (h ^ (h >> 13)).wrapping_mul(1274126177);
    h ^= h >> 16;
    ((h & 0xffff) as f64 / 65536.0, (h >> 16) as f64 / 65536.0)
}

/// A field sampled on a coarse grid aligned to multiples of `stride` in global
/// pixel space.
struct Grid {
    stride: usize,
    ox: i64,
    oy: i64,
    nx: usize,
    ny: usize,
    data: Vec<f32>,
}

impl Grid {
    fn empty() -> Self {
        Self { stride: 1, ox: 0, oy: 0, nx: 0, ny: 0, data: Vec::new() }
    }

    fn fill<F: Fn(f64, f64) -> f64>(
        &mut self,
        stride: usize,
        tile_x: usize,
        tile_y: usize,
        w: usize,
        h: usize,
        f: F,
    ) {
        let s = stride as i64;
        self.stride = stride;
        self.ox = (tile_x as i64 / s) * s;
        self.oy = (tile_y as i64 / s) * s;
        self.nx = ((tile_x + w - 1) as i64 - self.ox) as usize / stride + 2;
        self.ny = ((tile_y + h - 1) as i64 - self.oy) as usize / stride + 2;
        self.data.clear();
        self.data.reserve(self.nx * self.ny);
        for j in 0..self.ny {
            let gy = (self.oy + j as i64 * s) as f64;
            for i in 0..self.nx {
                let gx = (self.ox + i as i64 * s) as f64;
                self.data.push(f(gx, gy) as f32);
            }
        }
    }

    /// Adds `weight * field` for every pixel of global row `gy`, columns
    /// `tile_x .. tile_x + w`, into `row`.
    fn add_row(&self, row: &mut [f64], tile_x: usize, gy: usize, weight: f64) {
        if self.nx == 0 {
            return;
        }
        let s = self.stride;
        let inv = 1.0 / s as f64;
        let ly = gy as i64 - self.oy;
        let j = (ly as usize) / s;
        let ty = (ly as usize - j * s) as f64 * inv;
        let r0 = &self.data[j * self.nx..(j + 1) * self.nx];
        let r1 = &self.data[(j + 1) * self.nx..(j + 2) * self.nx];
        // Walk cells incrementally instead of dividing per pixel.
        let gx0 = (tile_x as i64 - self.ox) as usize;
        let mut i = gx0 / s;
        let mut k = gx0 - i * s;
        let mut a = r0[i] as f64 + ty * (r1[i] as f64 - r0[i] as f64);
        let mut b = r0[i + 1] as f64 + ty * (r1[i + 1] as f64 - r0[i + 1] as f64);
        for out in row.iter_mut() {
            *out += weight * (a + (k as f64 * inv) * (b - a));
            k += 1;
            if k == s {
                k = 0;
                i += 1;
                a = b;
                if i + 1 < self.nx {
                    b = r0[i + 1] as f64 + ty * (r1[i + 1] as f64 - r0[i + 1] as f64);
                }
            }
        }
    }
}

struct State {
    lut: Lut,
    pixels: Vec<u8>,
    outline: Vec<f32>,
    tone: Grid,
    form_low: Grid,
    form_mid: Grid,
    patina: Grid,
    row_lum: Vec<f64>,
    row_patina: Vec<f64>,
}

thread_local! {
    static STATE: RefCell<Option<State>> = const { RefCell::new(None) };
}

fn with_state<R>(f: impl FnOnce(&mut State) -> R) -> R {
    STATE.with(|cell| {
        let mut slot = cell.borrow_mut();
        let state = slot.get_or_insert_with(|| State {
            lut: Lut::new(),
            pixels: Vec::new(),
            outline: Vec::new(),
            tone: Grid::empty(),
            form_low: Grid::empty(),
            form_mid: Grid::empty(),
            patina: Grid::empty(),
            row_lum: Vec::new(),
            row_patina: Vec::new(),
        });
        f(state)
    })
}

/// Returns a pointer to a reusable f32 buffer of `len` entries that JS fills
/// with the deckle outline: top (full_w + 1), bottom (full_w + 1),
/// left (full_h + 1), right (full_h + 1).
#[no_mangle]
pub extern "C" fn outline_buffer(len: u32) -> *mut f32 {
    with_state(|s| {
        s.outline.resize(len as usize, 0.0);
        s.outline.as_mut_ptr()
    })
}

#[inline(always)]
fn deckle_erase(pos: f64, inset: f32, rough: f64) -> f64 {
    let inset = inset as f64;
    if inset <= 0.0 || pos >= inset {
        return 0.0;
    }
    let t = pos / inset;
    let mid = 0.58 * rough;
    if t < 0.52 {
        1.0 + (mid - 1.0) * (t / 0.52)
    } else {
        mid * (1.0 - (t - 0.52) / 0.48)
    }
}

/// Clamp to [0, 255] and round half up (same as JS `Math.round` on this range).
/// `f64::round` would be a libm call in wasm; floor(x + 0.5) is a truncation.
#[inline(always)]
fn quantise(v: f64) -> u8 {
    (v.clamp(0.0, 255.0) + 0.5) as u8
}

#[inline(always)]
fn smoothstep(e0: f64, e1: f64, x: f64) -> f64 {
    let t = ((x - e0) / (e1 - e0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// Renders a `tile_w` x `tile_h` RGBA tile whose top-left corner sits at
/// (`tile_x`, `tile_y`) of a `full_w` x `full_h` sheet. Returns a pointer to
/// the pixel buffer, which stays valid until the next call.
///
/// `base_*` already include the warmth shift. `deckle_rough < 0` disables the deckle alpha; otherwise the outline buffer
/// must have been filled for this sheet.
#[no_mangle]
#[allow(clippy::too_many_arguments)]
pub extern "C" fn render_paper_tone(
    tile_w: u32,
    tile_h: u32,
    tile_x: u32,
    tile_y: u32,
    full_w: u32,
    full_h: u32,
    base_r: f64,
    base_g: f64,
    base_b: f64,
    tone_seed: i32,
    formation_seed: i32,
    detail_seed: i32,
    aging_seed: i32,
    texture_boost: f64,
    grain_boost: f64,
    absorbency_boost: f64,
    age_amount: f64,
    deckle_rough: f64,
) -> *mut u8 {
    with_state(|st| {
        let w = tile_w as usize;
        let h = tile_h as usize;
        let tx0 = tile_x as usize;
        let ty0 = tile_y as usize;
        let fw = full_w as usize;
        let fh = full_h as usize;
        st.pixels.resize(w * h * 4, 0);
        if w == 0 || h == 0 {
            return st.pixels.as_mut_ptr();
        }

        let lut = &st.lut;
        let use_texture = texture_boost != 0.0;
        let use_grain = grain_boost != 0.0;
        let use_tone = absorbency_boost != 0.0;
        let use_age = age_amount > 0.0;

        let formation = if use_texture { Some(ValueNoise::new(formation_seed)) } else { None };
        let detail = if use_grain { Some(ValueNoise::new(detail_seed)) } else { None };

        st.tone.nx = 0;
        if use_tone {
            let tone = ValueNoise::new(tone_seed);
            st.tone.fill(TONE_STRIDE, tx0, ty0, w, h, |x, y| {
                tone.noise2d(lut, x * TONE_FREQ, y * TONE_FREQ, 4, 0.5) - TONE_MEAN
            });
        }
        st.form_low.nx = 0;
        st.form_mid.nx = 0;
        if let Some(form) = &formation {
            st.form_low.fill(FORM_LOW_STRIDE, tx0, ty0, w, h, |x, y| {
                form.noise2d(lut, x * FORM_LOW_FREQ, y * FORM_LOW_FREQ, 3, 0.55) - FORM_MEAN
            });
            st.form_mid.fill(FORM_MID_STRIDE, tx0, ty0, w, h, |x, y| {
                form.noise2d(lut, x * FORM_MID_FREQ + 20.0, y * FORM_MID_FREQ + 20.0, 3, 0.55)
                    - FORM_MEAN
            });
        }
        st.patina.nx = 0;
        if use_age {
            let aging = ValueNoise::new(aging_seed);
            let edge_scale = 1.0 / (0.07 * (fw.min(fh) as f64).max(1.0));
            let (fwf, fhf) = (fw as f64 - 1.0, fh as f64 - 1.0);
            st.patina.fill(PATINA_STRIDE, tx0, ty0, w, h, |x, y| {
                let p = aging.noise2d(lut, x * PATINA_FREQ, y * PATINA_FREQ, 4, 0.52);
                let stain = smoothstep(0.36, 0.68, p);
                let d = x.min(y).min(fwf - x).min(fhf - y).max(0.0);
                let edge = (-d * edge_scale).exp();
                stain * 0.55 + edge * (0.45 + 0.5 * p)
            });
        }

        st.row_lum.resize(w, 0.0);
        st.row_patina.resize(w, 0.0);
        let has_deckle = deckle_rough >= 0.0 && st.outline.len() >= 2 * (fw + 1) + 2 * (fh + 1);
        let (top, rest) = st.outline.split_at(if has_deckle { fw + 1 } else { 0 });
        let (bottom, rest) = rest.split_at(if has_deckle { fw + 1 } else { 0 });
        let (left, right) = rest.split_at(if has_deckle { fh + 1 } else { 0 });

        let px = &mut st.pixels;

        for ly in 0..h {
            let gy = ty0 + ly;
            let row = &mut st.row_lum;
            row.fill(0.0);
            st.tone.add_row(row, tx0, gy, absorbency_boost);
            st.form_low.add_row(row, tx0, gy, FORM_LOW_W * texture_boost);
            st.form_mid.add_row(row, tx0, gy, FORM_MID_W * texture_boost);
            let prow = &mut st.row_patina;
            if use_age {
                prow.fill(0.0);
                st.patina.add_row(prow, tx0, gy, age_amount);
            }
            let gyf = gy as f64;

            for lx in 0..w {
                let gx = tx0 + lx;
                let gxf = gx as f64;
                let (u_grain, u_dither) = hash_pair(gx as i32, gy as i32, detail_seed);

                let mut v = row[lx];
                if let Some(form) = &formation {
                    let hi = form.noise2d(
                        lut,
                        gxf * FORM_HI_FREQ + 40.0,
                        gyf * FORM_HI_FREQ + 40.0,
                        2,
                        0.55,
                    ) - FORM_HI_MEAN;
                    v += hi * FORM_HI_W * texture_boost;
                }
                if let Some(det) = &detail {
                    let g = det.noise2d(lut, gxf * DETAIL_FREQ, gyf * DETAIL_FREQ, 2, 0.48)
                        - DETAIL_MEAN
                        + (u_grain - 0.5) * 0.14;
                    v += g * grain_boost;
                }

                let mut r = base_r + v;
                let mut g = base_g + v;
                let mut b = base_b + v;
                if use_age {
                    let a = prow[lx];
                    r -= a * 6.0;
                    g -= a * 11.0;
                    b -= a * 22.0;
                }

                // ±0.5 level dither before quantisation (shared across channels
                // so it does not add chroma noise).
                let d = u_dither - 0.5;
                let i = (ly * w + lx) * 4;
                px[i] = quantise(r + d);
                px[i + 1] = quantise(g + d);
                px[i + 2] = quantise(b + d);

                let mut alpha = 1.0f64;
                if has_deckle {
                    let py = gyf + 0.5;
                    let pxc = gxf + 0.5;
                    alpha *= 1.0 - deckle_erase(py, top[gx.min(fw)], deckle_rough);
                    alpha *= 1.0 - deckle_erase(fh as f64 - py, bottom[gx.min(fw)], deckle_rough);
                    alpha *= 1.0 - deckle_erase(pxc, left[gy.min(fh)], deckle_rough);
                    alpha *= 1.0 - deckle_erase(fw as f64 - pxc, right[gy.min(fh)], deckle_rough);
                }
                px[i + 3] = quantise(alpha * 255.0);
            }
        }

        px.as_mut_ptr()
    })
}
