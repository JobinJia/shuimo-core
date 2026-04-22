use std::alloc::{alloc, dealloc, Layout};
use std::f64::consts::PI;

const PERLIN_YWRAPB: i32 = 4;
const PERLIN_YWRAP: i32 = 1 << PERLIN_YWRAPB;
const PERLIN_SIZE: usize = 4095;
const TABLE_LEN: usize = PERLIN_SIZE + 1;

const COS_LUT_SIZE: usize = 1024;
const COS_LUT_LEN: usize = COS_LUT_SIZE + 1;

static mut COS_LUT: [f64; COS_LUT_LEN] = [0.0; COS_LUT_LEN];
static mut COS_LUT_READY: bool = false;

fn ensure_cos_lut() {
    unsafe {
        if COS_LUT_READY {
            return;
        }
        for i in 0..COS_LUT_LEN {
            COS_LUT[i] = 0.5 * (1.0 - (i as f64 / COS_LUT_SIZE as f64 * PI).cos());
        }
        COS_LUT_READY = true;
    }
}

#[inline(always)]
fn fast_scaled_cosine(i: f64) -> f64 {
    let t = i * COS_LUT_SIZE as f64;
    let idx = t as usize;
    let frac = t - idx as f64;
    unsafe {
        if idx >= COS_LUT_SIZE {
            return COS_LUT[COS_LUT_SIZE];
        }
        COS_LUT[idx] + frac * (COS_LUT[idx + 1] - COS_LUT[idx])
    }
}

struct PerlinNoise {
    table: [f64; TABLE_LEN],
    octaves: u32,
    amp_falloff: f64,
}

impl PerlinNoise {
    fn new(seed: i32, octaves: u32, falloff: f64) -> Self {
        let a: u32 = 1664525;
        let c: u32 = 1013904223;
        let mut z: u32 = seed as u32;
        let mut table = [0.0f64; TABLE_LEN];
        for item in table.iter_mut() {
            z = a.wrapping_mul(z).wrapping_add(c);
            *item = z as f64 / 4294967296.0;
        }
        Self {
            table,
            octaves,
            amp_falloff: falloff,
        }
    }

    #[inline]
    fn noise2d(&self, x: f64, y: f64) -> f64 {
        let x = x.abs();
        let y = y.abs();
        let mut xi = x as i32;
        let mut yi = y as i32;
        let mut xf = x - xi as f64;
        let mut yf = y - yi as f64;
        let mut r = 0.0f64;
        let mut ampl = 0.5f64;

        for _ in 0..self.octaves {
            let of_val = xi.wrapping_add(yi.wrapping_shl(PERLIN_YWRAPB as u32));
            let rxf = fast_scaled_cosine(xf);
            let ryf = fast_scaled_cosine(yf);

            let i0 = (of_val as usize) & PERLIN_SIZE;
            let i1 = (of_val as usize).wrapping_add(1) & PERLIN_SIZE;
            let i2 = (of_val as usize).wrapping_add(PERLIN_YWRAP as usize) & PERLIN_SIZE;
            let i3 = (of_val as usize)
                .wrapping_add(PERLIN_YWRAP as usize)
                .wrapping_add(1)
                & PERLIN_SIZE;

            let mut n1 = self.table[i0];
            n1 += rxf * (self.table[i1] - n1);
            let mut n2 = self.table[i2];
            n2 += rxf * (self.table[i3] - n2);
            n1 += ryf * (n2 - n1);

            r += n1 * ampl;
            ampl *= self.amp_falloff;

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

#[inline(always)]
fn clamp_u8(value: f64) -> u8 {
    value.clamp(0.0, 255.0).round() as u8
}

#[no_mangle]
pub extern "C" fn wasm_alloc(size: usize) -> *mut u8 {
    let layout = Layout::from_size_align(size, 4).unwrap();
    unsafe { alloc(layout) }
}

#[no_mangle]
pub extern "C" fn wasm_dealloc(ptr: *mut u8, size: usize) {
    if size == 0 {
        return;
    }
    let layout = Layout::from_size_align(size, 4).unwrap();
    unsafe { dealloc(ptr, layout) }
}

#[no_mangle]
pub extern "C" fn apply_paper_tone(
    ptr: *mut u8,
    data_len: u32,
    tile_width: u32,
    tile_height: u32,
    tile_x: u32,
    tile_y: u32,
    tone_seed: i32,
    formation_seed: i32,
    detail_seed: i32,
    aging_seed: i32,
    texture_boost: f64,
    grain_boost: f64,
    absorbency_boost: f64,
    warmth: f64,
    age: f64,
    patina_strength: f64,
) {
    ensure_cos_lut();

    let data = unsafe { std::slice::from_raw_parts_mut(ptr, data_len as usize) };

    let tone = PerlinNoise::new(tone_seed, 4, 0.5);
    let formation = PerlinNoise::new(formation_seed, 3, 0.55);
    let detail = PerlinNoise::new(detail_seed, 5, 0.48);
    let aging = PerlinNoise::new(aging_seed, 4, 0.52);

    let tw = tile_width as usize;
    let th = tile_height as usize;
    let has_age = age > 0.0;

    for ly in 0..th {
        let gy = (tile_y as usize + ly) as f64;
        for lx in 0..tw {
            let gx = (tile_x as usize + lx) as f64;
            let idx = (ly * tw + lx) * 4;

            let fiber_formation = formation.noise2d(gx * 0.018, gy * 0.018) * 0.58
                + formation.noise2d(gx * 0.07 + 20.0, gy * 0.07 + 20.0) * 0.26
                + formation.noise2d(gx * 0.22 + 40.0, gy * 0.22 + 40.0) * 0.16;
            let micro_grain = detail.noise2d(gx * 0.55, gy * 0.55) - 0.5;
            let tone_wave = tone.noise2d(gx * 0.004, gy * 0.004) - 0.5;

            let variation = (fiber_formation - 0.5) * texture_boost
                + micro_grain * grain_boost
                + tone_wave * absorbency_boost;

            let r = data[idx] as f64;
            let g = data[idx + 1] as f64;
            let b = data[idx + 2] as f64;

            data[idx] = clamp_u8(r + variation + warmth * 0.8);
            data[idx + 1] = clamp_u8(g + variation + warmth * 0.4);
            data[idx + 2] = clamp_u8(b + variation - warmth);

            if has_age {
                let patina = aging.noise2d(gx * 0.01, gy * 0.01);
                let foxing = aging.noise2d(gx * 0.08 + 120.0, gy * 0.08 + 60.0);
                let patina_amount = age * patina_strength * (patina - 0.42).max(0.0);

                data[idx] = clamp_u8(data[idx] as f64 + patina_amount * 10.0);
                data[idx + 1] = clamp_u8(data[idx + 1] as f64 + patina_amount * 5.0);
                data[idx + 2] = clamp_u8(data[idx + 2] as f64 - patina_amount * 14.0);

                if foxing > 0.87 {
                    let stain = (foxing - 0.87) * age * 160.0;
                    data[idx] = clamp_u8(data[idx] as f64 - stain * 0.6);
                    data[idx + 1] = clamp_u8(data[idx + 1] as f64 - stain * 0.85);
                    data[idx + 2] = clamp_u8(data[idx + 2] as f64 - stain * 0.35);
                }
            }
        }
    }
}
