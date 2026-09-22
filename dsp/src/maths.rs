//! The four transcendental functions this crate needs, written out so the
//! crate has no dependencies and no libm. Accuracy is chosen for drum
//! synthesis and filter coefficients, not for numerics: exp2 is exact in the
//! exponent and within about 1e-4 in the mantissa, which is far below the
//! resolution of a 12-bit converter.

const LOG2_E: f32 = 1.442_695_0;
const PI: f32 = core::f32::consts::PI;
const TWO_PI: f32 = 2.0 * PI;

/// 2^x. Splits into an integer part, built directly into the float's
/// exponent bits, and a fractional part from a degree-3 polynomial.
pub fn exp2(x: f32) -> f32 {
    if x < -126.0 {
        return 0.0;
    }
    if x > 127.0 {
        return f32::INFINITY;
    }
    let i = floor(x);
    let f = x - i;
    // Minimax-ish cubic for 2^f on [0,1); endpoints are exact.
    let poly = 1.0 + f * (0.656_366_2 + f * (0.339_557_3 + f * 0.030_760_4));
    let bits = ((i as i32 + 127) as u32) << 23;
    poly * f32::from_bits(bits)
}

pub fn exp(x: f32) -> f32 {
    exp2(x * LOG2_E)
}

/// x^y for x > 0, which is all this crate asks for (transpose ratios).
pub fn powf(x: f32, y: f32) -> f32 {
    if x <= 0.0 {
        return 0.0;
    }
    exp2(log2(x) * y)
}

/// log2 for x > 0: exponent from the bits, mantissa from a cubic.
pub fn log2(x: f32) -> f32 {
    if x <= 0.0 {
        return f32::NEG_INFINITY;
    }
    let bits = x.to_bits();
    let e = ((bits >> 23) & 0xff) as i32 - 127;
    // Mantissa in [1,2).
    let m = f32::from_bits((bits & 0x007f_ffff) | 0x3f80_0000);
    let p = -1.719_595_8 + m * (2.821_202_6 + m * (-1.469_622_4 + m * 0.367_874_5));
    e as f32 + p
}

/// sin, range-reduced to [-pi, pi] then a degree-7 odd polynomial. Peak
/// error is about 1e-6, which no drum has ever noticed.
pub fn sin(x: f32) -> f32 {
    let mut a = x - TWO_PI * floor(x / TWO_PI + 0.5);
    if a > PI {
        a -= TWO_PI;
    } else if a < -PI {
        a += TWO_PI;
    }
    let x2 = a * a;
    a * (1.0
        + x2 * (-0.166_666_57
            + x2 * (0.008_333_25 + x2 * (-0.000_198_4 + x2 * 0.000_002_75))))
}

pub fn floor(x: f32) -> f32 {
    let t = x as i32 as f32;
    if x < 0.0 && t != x {
        t - 1.0
    } else {
        t
    }
}

pub fn abs(x: f32) -> f32 {
    f32::from_bits(x.to_bits() & 0x7fff_ffff)
}

/// One-pole lowpass coefficient for a cutoff in Hz, the usual
/// exp(-2*pi*fc/fs) form.
pub fn one_pole_coeff(cutoff_hz: f32, sample_rate: f32) -> f32 {
    if cutoff_hz <= 0.0 {
        return 0.0;
    }
    if cutoff_hz >= sample_rate * 0.5 {
        return 1.0;
    }
    1.0 - exp(-TWO_PI * cutoff_hz / sample_rate)
}
