// Perlin noise engine — optimized for WASM shuimo-core
// LUT-based cosine interpolation matches xuan-paper-tone approach.

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
        if COS_LUT_READY { return; }
        for i in 0..COS_LUT_LEN {
            COS_LUT[i] = 0.5 * (1.0 - (i as f64 / COS_LUT_SIZE as f64 * std::f64::consts::PI).cos());
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
        if idx >= COS_LUT_SIZE { return COS_LUT[COS_LUT_SIZE]; }
        COS_LUT[idx] + frac * (COS_LUT[idx + 1] - COS_LUT[idx])
    }
}

pub struct PerlinNoise {
    table: Box<[f64; TABLE_LEN]>,
    octaves: u32,
    amp_falloff: f64,
}

impl PerlinNoise {
    pub fn new(seed: i32, octaves: u32, falloff: f64) -> Self {
        ensure_cos_lut();
        let a: u32 = 1664525;
        let c: u32 = 1013904223;
        let mut z: u32 = seed as u32;
        // Box the large table to avoid stack overflow in WASM
        let mut table = Box::new([0.0f64; TABLE_LEN]);
        for item in table.iter_mut() {
            z = a.wrapping_mul(z).wrapping_add(c);
            *item = z as f64 / 4294967296.0;
        }
        Self { table, octaves, amp_falloff: falloff }
    }

    #[inline]
    pub fn noise2d(&self, x: f64, y: f64) -> f64 {
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
                .wrapping_add(1) & PERLIN_SIZE;

            let mut n1 = self.table[i0];
            n1 += rxf * (self.table[i1] - n1);
            let mut n2 = self.table[i2];
            n2 += rxf * (self.table[i3] - n2);
            n1 += ryf * (n2 - n1);

            r += n1 * ampl;
            ampl *= self.amp_falloff;

            xi <<= 1; xf *= 2.0;
            yi <<= 1; yf *= 2.0;

            if xf >= 1.0 { xi += 1; xf -= 1.0; }
            if yf >= 1.0 { yi += 1; yf -= 1.0; }
        }
        r
    }

    /// Single-call 3D noise (z channel for wispy filter)
    #[inline]
    pub fn noise3d(&self, x: f64, y: f64, z: f64) -> f64 {
        let x = x.abs();
        let y = y.abs();
        let z = z.abs();
        let PERLIN_ZWRAPB: i32 = 8;
        let PERLIN_ZWRAP: i32 = 1 << PERLIN_ZWRAPB;

        let mut xi = x as i32;
        let mut yi = y as i32;
        let mut zi = z as i32;
        let mut xf = x - xi as f64;
        let mut yf = y - yi as f64;
        let mut zf = z - zi as f64;
        let mut r = 0.0f64;
        let mut ampl = 0.5f64;

        for _ in 0..self.octaves {
            let of =
                xi + (yi << PERLIN_YWRAPB) + (zi << PERLIN_ZWRAPB);
            let rxf = fast_scaled_cosine(xf);
            let ryf = fast_scaled_cosine(yf);
            let rzf = fast_scaled_cosine(zf);

            let mut n1 = self.table[(of as usize) & PERLIN_SIZE];
            n1 += rxf * (self.table[(of as usize + 1) & PERLIN_SIZE] - n1);
            let mut n2 = self.table[(of as usize + PERLIN_YWRAP as usize) & PERLIN_SIZE];
            n2 += rxf * (self.table[(of as usize + PERLIN_YWRAP as usize + 1) & PERLIN_SIZE] - n2);
            n1 += ryf * (n2 - n1);

            let of2 = of + PERLIN_ZWRAP;
            let mut n2b = self.table[(of2 as usize) & PERLIN_SIZE];
            n2b += rxf * (self.table[(of2 as usize + 1) & PERLIN_SIZE] - n2b);
            let mut n3 = self.table[(of2 as usize + PERLIN_YWRAP as usize) & PERLIN_SIZE];
            n3 += rxf * (self.table[(of2 as usize + PERLIN_YWRAP as usize + 1) & PERLIN_SIZE] - n3);
            n2b += ryf * (n3 - n2b);

            n1 += rzf * (n2b - n1);
            r += n1 * ampl;
            ampl *= self.amp_falloff;

            xi <<= 1; xf *= 2.0;
            yi <<= 1; yf *= 2.0;
            zi <<= 1; zf *= 2.0;
        }
        r
    }
}
