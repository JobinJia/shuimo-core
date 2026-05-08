// Gabor noise — anisotropic fiber texture for xuan paper background.
// Reference: Gabor noise by example (Lagae et al.)
// Produces directional fiber patterns similar to handmade paper grain.

use std::f64::consts::PI;

pub struct GaborNoise {
    seed: u32,
    kernel_radius: f64,
}

struct Kernel {
    cx: f64,
    cy: f64,
    frequency: f64,
    amplitude: f64,
    angle: f64,
    bandwidth: f64,
}

// Cheap sin-based hash for jittered grid
fn hash2(seed: u32, cx: i32, cy: i32) -> (f64, f64, f64, f64) {
    let a: u32 = 1664525;
    let b: u32 = 1013904223;
    let h = (seed
        .wrapping_add(cx as u32 * 374761393)
        .wrapping_add(cy as u32 * 668265263))
        .wrapping_mul(a)
        .wrapping_add(b);
    let u1 = ((h >> 16) & 0xFFFF) as f64 / 65536.0;
    let u2 = (h & 0xFFFF) as f64 / 65536.0;
    let h2 = h.wrapping_mul(a).wrapping_add(b);
    let u3 = ((h2 >> 16) & 0xFFFF) as f64 / 65536.0;
    let u4 = (h2 & 0xFFFF) as f64 / 65536.0;
    (u1, u2, u3, u4)
}

// Box-Muller for Gaussian random (from uniform u1, u2)
fn box_muller(u1: f64, u2: f64) -> (f64, f64) {
    let r = (-2.0 * u1.max(1e-10).ln()).sqrt();
    let theta = 2.0 * PI * u2;
    (r * theta.cos(), r * theta.sin())
}

impl GaborNoise {
    pub fn new(seed: u32, kernel_radius: f64) -> Self {
        Self { seed, kernel_radius }
    }

    fn kernel_for_cell(&self, cx: i32, cy: i32) -> Vec<Kernel> {
        let (u1, u2, u3, u4) = hash2(self.seed, cx, cy);
        let count = 1 + (u1 * 3.999_f64) as usize; // 1-4 kernels per cell
        let mut kernels = Vec::with_capacity(count);

        for i in 0..count {
            let offset = i as f64 * 0.25;
            let jx = (u1 + offset).fract();
            let jy = (u1 + offset + 0.5).fract();
            let px = cx as f64 + jx;
            let py = cy as f64 + jy;
            let (g0, g1) = box_muller(u2, u3);
            let freq = 3.0 + u4 * 5.0;
            let amp = 0.3 + g0.abs() * 0.7;
            let angle = g1 * PI;
            let bw = 2.0 + u2 * 3.0;

            kernels.push(Kernel {
                cx: px, cy: py, frequency: freq,
                amplitude: amp, angle, bandwidth: bw,
            });
        }
        kernels
    }

    /// Anisotropic Gabor noise at (x, y). Returns value in [0, 1].
    pub fn noise2d(&self, x: f64, y: f64) -> f64 {
        let cx = x.floor() as i32;
        let cy = y.floor() as i32;
        let fx = x - cx as f64;
        let fy = y - cy as f64;
        let mut total = 0.0f64;

        for dy in -1..=1i32 {
            for dx in -1..=1i32 {
                let kernels = self.kernel_for_cell(cx + dx, cy + dy);
                for k in &kernels {
                    let kx = k.cx - (cx as f64 + fx) + dx as f64;
                    let ky = k.cy - (cy as f64 + fy) + dy as f64;
                    let d2 = kx * kx + ky * ky;
                    if d2 > self.kernel_radius * self.kernel_radius { continue; }

                    // Project onto kernel direction
                    let proj = kx * k.angle.cos() + ky * k.angle.sin();
                    let gauss = (-d2 * 0.5 / (k.bandwidth * k.bandwidth)).exp();
                    let carrier = (2.0 * PI * k.frequency * proj).cos();
                    total += k.amplitude * gauss * carrier;
                }
            }
        }
        // Normalize to [0, 1]
        (total * 0.25 + 0.5).clamp(0.0, 1.0)
    }
}
