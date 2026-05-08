// Worley (Voronoi) noise — used in mistyMount particle placement.

pub struct WorleyNoise {
    seed: u32,
}

impl WorleyNoise {
    pub fn new(seed: u32) -> Self { Self { seed } }

    fn cell_hash(&self, cx: i32, cy: i32) -> (f64, f64) {
        let a: u32 = 1664525;
        let b: u32 = 1013904223;
        let h = (self.seed
            .wrapping_add(cx as u32 * 374761393)
            .wrapping_add(cy as u32 * 668265263))
            .wrapping_mul(a)
            .wrapping_add(b);
        let u = (h >> 16) as f64 / 65536.0;
        let v = ((h & 0xFFFF) >> 16) as f64 / 65536.0;
        (u, v)
    }

    #[inline]
    pub fn noise2d(&self, x: f64, y: f64) -> f64 {
        let cx = x.floor() as i32;
        let cy = y.floor() as i32;
        let fx = x - cx as f64;
        let fy = y - cy as f64;
        let mut min_dist = f64::MAX;

        for dy in -1..=1i32 {
            for dx in -1..=1i32 {
                let (rx, ry) = self.cell_hash(cx + dx, cy + dy);
                let px = dx as f64 + rx - fx;
                let py = dy as f64 + ry - fy;
                let d = (px * px + py * py).sqrt();
                if d < min_dist { min_dist = d; }
            }
        }
        min_dist
    }

    /// F2 - F1 edge distance (ridge noise)
    pub fn edge2d(&self, x: f64, y: f64) -> f64 {
        let cx = x.floor() as i32;
        let cy = y.floor() as i32;
        let fx = x - cx as f64;
        let fy = y - cy as f64;
        let mut f1 = f64::MAX;
        let mut f2 = f64::MAX;

        for dy in -1..=1i32 {
            for dx in -1..=1i32 {
                let (rx, ry) = self.cell_hash(cx + dx, cy + dy);
                let px = dx as f64 + rx - fx;
                let py = dy as f64 + ry - fy;
                let d = (px * px + py * py).sqrt();
                if d < f1 { f2 = f1; f1 = d; }
                else if d < f2 { f2 = d; }
            }
        }
        f2 - f1
    }

    /// Multi-octave fBm variant
    pub fn fbm2d(&self, x: f64, y: f64, octaves: u32, lacunarity: f64, gain: f64) -> f64 {
        let mut sum = 0.0;
        let mut amp = 1.0;
        let mut freq = 1.0;
        let mut max = 0.0;

        for _ in 0..octaves {
            sum += self.noise2d(x * freq, y * freq) * amp;
            max += amp;
            freq *= lacunarity;
            amp *= gain;
        }
        sum / max
    }
}
