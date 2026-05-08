mod perlin;
mod worley;
mod gabor;
mod stamp;

use perlin::PerlinNoise;
use worley::WorleyNoise;
use gabor::GaborNoise;
use std::cell::RefCell;
use wasm_bindgen::prelude::*;

thread_local! {
    static PERLIN: RefCell<Option<PerlinNoise>> = const { RefCell::new(None) };
    static WORLEY: RefCell<Option<WorleyNoise>> = const { RefCell::new(None) };
}

/// Initialize noise engines from a seed. Must be called before sampling.
#[wasm_bindgen]
pub fn shuimo_noise_init(perlin_seed: i32, worley_seed: i32, octaves: u32, falloff: f64) {
    PERLIN.with(|p| {
        *p.borrow_mut() = Some(PerlinNoise::new(perlin_seed, octaves, falloff));
    });
    WORLEY.with(|w| {
        *w.borrow_mut() = Some(WorleyNoise::new(worley_seed as u32));
    });
}

/// Single 2D Perlin noise sample.
#[wasm_bindgen]
pub fn shuimo_perlin2d(x: f64, y: f64) -> f64 {
    PERLIN.with(|p| {
        p.borrow().as_ref().expect("shuimo_noise_init not called").noise2d(x, y)
    })
}

/// Single 3D Perlin noise sample.
#[wasm_bindgen]
pub fn shuimo_perlin3d(x: f64, y: f64, z: f64) -> f64 {
    PERLIN.with(|p| {
        p.borrow().as_ref().expect("shuimo_noise_init not called").noise3d(x, y, z)
    })
}

/// Batch 2D Perlin noise. wasm-bindgen auto-copies slices from JS.
#[wasm_bindgen]
pub fn shuimo_perlin2d_batch(xs: &[f64], ys: &[f64], out: &mut [f64]) {
    PERLIN.with(|p| {
        let p = p.borrow();
        let perlin = p.as_ref().expect("shuimo_noise_init not called");
        let n = out.len().min(xs.len()).min(ys.len());
        for i in 0..n {
            out[i] = perlin.noise2d(xs[i], ys[i]);
        }
    })
}

/// Batch 3D Perlin noise.
#[wasm_bindgen]
pub fn shuimo_perlin3d_batch(xs: &[f64], ys: &[f64], zs: &[f64], out: &mut [f64]) {
    PERLIN.with(|p| {
        let p = p.borrow();
        let perlin = p.as_ref().expect("shuimo_noise_init not called");
        let n = out.len().min(xs.len()).min(ys.len()).min(zs.len());
        for i in 0..n {
            out[i] = perlin.noise3d(xs[i], ys[i], zs[i]);
        }
    })
}

/// Single Worley noise sample.
#[wasm_bindgen]
pub fn shuimo_worley2d(x: f64, y: f64) -> f64 {
    WORLEY.with(|w| {
        w.borrow().as_ref().expect("shuimo_noise_init not called").noise2d(x, y)
    })
}

/// Worley edge noise (F2 - F1).
#[wasm_bindgen]
pub fn shuimo_worley_edge2d(x: f64, y: f64) -> f64 {
    WORLEY.with(|w| {
        w.borrow().as_ref().expect("shuimo_noise_init not called").edge2d(x, y)
    })
}

/// Worley fBm (multi-octave).
#[wasm_bindgen]
pub fn shuimo_worley_fbm2d(x: f64, y: f64, octaves: u32, lacunarity: f64, gain: f64) -> f64 {
    WORLEY.with(|w| {
        w.borrow().as_ref().expect("shuimo_noise_init not called").fbm2d(x, y, octaves, lacunarity, gain)
    })
}

/// Gabor noise (anisotropic fiber texture) — single sample.
#[wasm_bindgen]
pub fn shuimo_gabor2d(seed: u32, x: f64, y: f64, kernel_radius: f64) -> f64 {
    let gabor = GaborNoise::new(seed, kernel_radius);
    gabor.noise2d(x, y)
}

/// Gabor noise batch.
#[wasm_bindgen]
pub fn shuimo_gabor2d_batch(seed: u32, xs: &[f64], ys: &[f64], kernel_radius: f64, out: &mut [f64]) {
    let gabor = GaborNoise::new(seed, kernel_radius);
    let n = out.len().min(xs.len()).min(ys.len());
    for i in 0..n {
        out[i] = gabor.noise2d(xs[i], ys[i]);
    }
}

// ---- Stamp border paths ----

#[wasm_bindgen]
pub fn stamp_square_path(
    size: f64, border_points: u32, corner_radius: f64,
    noise_amount: f64, seed: u32, regular: bool,
    noise_octaves: u32, noise_falloff: f64,
) -> String {
    stamp::stamp_square_path(size, border_points, corner_radius, noise_amount, seed, regular, noise_octaves, noise_falloff)
}

#[wasm_bindgen]
pub fn stamp_rect_path(
    w: f64, h: f64, border_points: u32, corner_radius: f64,
    noise_amount: f64, seed: u32, regular: bool,
    noise_octaves: u32, noise_falloff: f64,
) -> String {
    stamp::stamp_rect_path(w, h, border_points, corner_radius, noise_amount, seed, regular, noise_octaves, noise_falloff)
}

#[wasm_bindgen]
pub fn stamp_circle_path(
    radius: f64, border_points: u32,
    noise_amount: f64, seed: u32, regular: bool,
    noise_octaves: u32, noise_falloff: f64,
) -> String {
    stamp::stamp_circle_path(radius, border_points, noise_amount, seed, regular, noise_octaves, noise_falloff)
}

#[wasm_bindgen]
pub fn stamp_ellipse_path(
    w: f64, h: f64, border_points: u32,
    noise_amount: f64, seed: u32, regular: bool,
    noise_octaves: u32, noise_falloff: f64,
) -> String {
    stamp::stamp_ellipse_path(w, h, border_points, noise_amount, seed, regular, noise_octaves, noise_falloff)
}
