// Stamp border path generation — ported from Stamp.ts.
// Generates SVG path d-strings with Perlin noise distortion on edges.

use crate::perlin::PerlinNoise;
use std::f64::consts::PI;

struct LCG {
    seed: u32,
}

impl LCG {
    fn new(seed: u32) -> Self { Self { seed } }
    fn next(&mut self) -> f64 {
        self.seed = self.seed.wrapping_mul(9301).wrapping_add(49297) % 233280;
        self.seed as f64 / 233280.0
    }
}

fn fmt_num(v: f64) -> String {
    let s = format!("{:.4}", v);
    let trimmed = s.trim_end_matches('0');
    if trimmed.ends_with('.') { format!("{}0", trimmed) } else { trimmed.to_string() }
}

struct PathBuilder {
    parts: Vec<String>,
}

impl PathBuilder {
    fn new(cap: usize) -> Self { Self { parts: Vec::with_capacity(cap) } }
    fn m(&mut self, x: f64, y: f64) { self.parts.push(format!("M {} {}", fmt_num(x), fmt_num(y))); }
    fn l(&mut self, x: f64, y: f64) { self.parts.push(format!("L {} {}", fmt_num(x), fmt_num(y))); }
    fn q(&mut self, cx: f64, cy: f64, x: f64, y: f64) {
        self.parts.push(format!("Q {},{} {},{}", fmt_num(cx), fmt_num(cy), fmt_num(x), fmt_num(y)));
    }
    fn c(&mut self, c1x: f64, c1y: f64, c2x: f64, c2y: f64, x: f64, y: f64) {
        self.parts.push(format!("C {},{} {},{} {},{}",
            fmt_num(c1x), fmt_num(c1y), fmt_num(c2x), fmt_num(c2y), fmt_num(x), fmt_num(y)));
    }
    fn z(&mut self) { self.parts.push("Z".to_string()); }
    fn build(&self) -> String { self.parts.join(" ") }
}

/// Sin with period 0..1 mapped to 0..PI (matching JS dsin)
fn dsin(t: f64) -> f64 { (t * PI).sin() }

struct CornerRadii {
    tl: f64, tr: f64, br: f64, bl: f64,
}

fn randomize_corner_radii(base: f64, rng: &mut LCG, regular: bool) -> CornerRadii {
    if regular { return CornerRadii { tl: base, tr: base, br: base, bl: base }; }
    CornerRadii {
        tl: base * (0.8 + rng.next() * 0.4),
        tr: base * (0.8 + rng.next() * 0.4),
        br: base * (0.8 + rng.next() * 0.4),
        bl: base * (0.8 + rng.next() * 0.4),
    }
}

fn generate_edge_points(
    b: &mut PathBuilder,
    from_x: f64, from_y: f64, to_x: f64, to_y: f64,
    count: u32, full_noise: bool,
    inward_nx: f64, inward_ny: f64,
    noise_amount: f64, noise_density: f64, perlin: &PerlinNoise,
) {
    let ns = 0.015 * noise_density;
    for i in 1..count {
        let t = i as f64 / count as f64;
        let ep = if full_noise { 1.0 } else { dsin(t) };
        let x = from_x + t * (to_x - from_x);
        let y = from_y + t * (to_y - from_y);

        let nx = perlin.noise3d(x * ns, y * ns, 0.0) - 0.5;
        let ny = perlin.noise3d(x * ns, y * ns, 100.0) - 0.5;
        let tnx = nx * noise_amount * ep;
        let tny = ny * noise_amount * ep;

        let proj = tnx * inward_nx + tny * inward_ny;
        let inward = proj.max(0.0);

        b.l(x + inward * inward_nx, y + inward * inward_ny);
    }
}

fn build_regular_quad(w: f64, h: f64, cr: &CornerRadii) -> String {
    let mut b = PathBuilder::new(20);
    b.m(cr.tl, 0.0);
    b.l(w - cr.tr, 0.0);
    b.q(w, 0.0, w, cr.tr);
    b.l(w, h - cr.br);
    b.q(w, h, w - cr.br, h);
    b.l(cr.bl, h);
    b.q(0.0, h, 0.0, h - cr.bl);
    b.l(0.0, cr.tl);
    b.q(0.0, 0.0, cr.tl, 0.0);
    b.z();
    b.build()
}

// ---- Public API ----

/// Generate a square stamp border path.
#[allow(clippy::too_many_arguments)]
pub fn stamp_square_path(
    size: f64, border_points: u32, corner_radius: f64,
    noise_amount: f64, seed: u32, regular: bool,
    noise_octaves: u32, noise_falloff: f64,
    noise_density: f64,
) -> String {
    let mut rng = LCG::new(seed);
    if regular {
        let cr = randomize_corner_radii(corner_radius, &mut rng, true);
        return build_regular_quad(size, size, &cr);
    }
    let perlin = PerlinNoise::new(seed as i32, noise_octaves, noise_falloff);
    let r = corner_radius.min(size * 0.03);
    let pe = (border_points / 4).max(1);
    let mut b = PathBuilder::new((pe * 4 + 10) as usize);

    b.m(r, 0.0);
    generate_edge_points(&mut b, r, 0.0, size - r, 0.0, pe, true, 0.0, 1.0, noise_amount, noise_density, &perlin);
    b.q(size, 0.0, size, r);
    generate_edge_points(&mut b, size, r, size, size - r, pe, false, -1.0, 0.0, noise_amount, noise_density, &perlin);
    b.q(size, size, size - r, size);
    generate_edge_points(&mut b, size - r, size, r, size, pe, false, 0.0, -1.0, noise_amount, noise_density, &perlin);
    b.q(0.0, size, 0.0, size - r);
    generate_edge_points(&mut b, 0.0, size - r, 0.0, r, pe, false, 1.0, 0.0, noise_amount, noise_density, &perlin);
    b.q(0.0, 0.0, r, 0.0);
    b.z();
    b.build()
}

/// Generate a rectangle stamp border path.
pub fn stamp_rect_path(
    w: f64, h: f64, border_points: u32, corner_radius: f64,
    noise_amount: f64, seed: u32, regular: bool,
    noise_octaves: u32, noise_falloff: f64,
    noise_density: f64,
) -> String {
    let mut rng = LCG::new(seed);
    if regular {
        let cr = randomize_corner_radii(corner_radius, &mut rng, true);
        return build_regular_quad(w, h, &cr);
    }
    let perlin = PerlinNoise::new(seed as i32, noise_octaves, noise_falloff);
    let r = corner_radius.min(w.min(h) * 0.03);
    let pe = (border_points / 4).max(1);
    let mut b = PathBuilder::new((pe * 4 + 10) as usize);

    b.m(r, 0.0);
    generate_edge_points(&mut b, r, 0.0, w - r, 0.0, pe, true, 0.0, 1.0, noise_amount, noise_density, &perlin);
    b.q(w, 0.0, w, r);
    generate_edge_points(&mut b, w, r, w, h - r, pe, false, -1.0, 0.0, noise_amount, noise_density, &perlin);
    b.q(w, h, w - r, h);
    generate_edge_points(&mut b, w - r, h, r, h, pe, false, 0.0, -1.0, noise_amount, noise_density, &perlin);
    b.q(0.0, h, 0.0, h - r);
    generate_edge_points(&mut b, 0.0, h - r, 0.0, r, pe, false, 1.0, 0.0, noise_amount, noise_density, &perlin);
    b.q(0.0, 0.0, r, 0.0);
    b.z();
    b.build()
}

/// Generate a circle stamp border path.
pub fn stamp_circle_path(
    radius: f64, border_points: u32,
    noise_amount: f64, seed: u32, regular: bool,
    noise_octaves: u32, noise_falloff: f64,
    noise_density: f64,
) -> String {
    if regular {
        let k = 0.5522847498;
        let ox = radius * k; let oy = radius * k;
        let cx = radius; let cy = radius;
        let mut b = PathBuilder::new(10);
        b.m(cx, cy - radius);
        b.c(cx + ox, cy - radius, cx + radius, cy - oy, cx + radius, cy);
        b.c(cx + radius, cy + oy, cx + ox, cy + radius, cx, cy + radius);
        b.c(cx - ox, cy + radius, cx - radius, cy + oy, cx - radius, cy);
        b.c(cx - radius, cy - oy, cx - ox, cy - radius, cx, cy - radius);
        b.z();
        return b.build();
    }
    let perlin = PerlinNoise::new(seed as i32, noise_octaves, noise_falloff);
    let n = border_points.max(8);
    let mut b = PathBuilder::new((n + 5) as usize);
    let cx = radius; let cy = radius;

    for i in 0..n {
        let angle = i as f64 / n as f64 * 2.0 * PI - PI / 2.0;
        let x = cx + angle.cos() * radius;
        let y = cy + angle.sin() * radius;
        let nx = angle.cos();
        let ny = angle.sin();
        let inx = -nx; let iny = -ny;

        let ns = 0.015 * noise_density;
        let nx_v = perlin.noise3d(x * ns, y * ns, 0.0) - 0.5;
        let ny_v = perlin.noise3d(x * ns, y * ns, 100.0) - 0.5;
        let tnx = nx_v * noise_amount;
        let tny = ny_v * noise_amount;
        let proj = (tnx * inx + tny * iny).max(0.0);
        let fx = x + proj * inx;
        let fy = y + proj * iny;

        if i == 0 { b.m(fx, fy); } else { b.l(fx, fy); }
    }
    b.z();
    b.build()
}

/// Generate an ellipse stamp border path.
pub fn stamp_ellipse_path(
    w: f64, h: f64, border_points: u32,
    noise_amount: f64, seed: u32, regular: bool,
    noise_octaves: u32, noise_falloff: f64,
    noise_density: f64,
) -> String {
    if regular {
        let k = 0.5522847498;
        let cx = w / 2.0; let cy = h / 2.0;
        let rx = w / 2.0; let ry = h / 2.0;
        let ox = rx * k; let oy = ry * k;
        let mut b = PathBuilder::new(10);
        b.m(cx, cy - ry);
        b.c(cx + ox, cy - ry, cx + rx, cy - oy, cx + rx, cy);
        b.c(cx + rx, cy + oy, cx + ox, cy + ry, cx, cy + ry);
        b.c(cx - ox, cy + ry, cx - rx, cy + oy, cx - rx, cy);
        b.c(cx - rx, cy - oy, cx - ox, cy - ry, cx, cy - ry);
        b.z();
        return b.build();
    }
    let perlin = PerlinNoise::new(seed as i32, noise_octaves, noise_falloff);
    let n = border_points.max(8);
    let mut b = PathBuilder::new((n + 5) as usize);
    let cx = w / 2.0; let cy = h / 2.0;
    let rx = w / 2.0; let ry = h / 2.0;

    for i in 0..n {
        let angle = i as f64 / n as f64 * 2.0 * PI - PI / 2.0;
        let ca = angle.cos(); let sa = angle.sin();
        let x = cx + ca * rx;
        let y = cy + sa * ry;

        let gnx = ca / rx; let gny = sa / ry;
        let glen = (gnx * gnx + gny * gny).sqrt();
        let inx = -gnx / glen; let iny = -gny / glen;

        let ns = 0.015 * noise_density;
        let nx_v = perlin.noise3d(x * ns, y * ns, 0.0) - 0.5;
        let ny_v = perlin.noise3d(x * ns, y * ns, 100.0) - 0.5;
        let tnx = nx_v * noise_amount;
        let tny = ny_v * noise_amount;
        let proj = (tnx * inx + tny * iny).max(0.0);
        let fx = x + proj * inx;
        let fy = y + proj * iny;

        if i == 0 { b.m(fx, fy); } else { b.l(fx, fy); }
    }
    b.z();
    b.build()
}
