//! A bump allocator over wasm linear memory.
//!
//! The pads need about 10MB. Declared as static arrays they would be written
//! into the wasm file as ten megabytes of zeroes; taken as pages at init they
//! cost nothing on the wire and the module stays a few kilobytes. Nothing is
//! ever freed, because nothing here has a lifetime shorter than the program.

use core::arch::wasm32::memory_grow;

const PAGE: usize = 65_536;

/// Grows linear memory by enough pages for `count` f32s and returns the start.
/// Returns null if the host refuses to grow, which the caller treats as fatal.
pub fn alloc_f32(count: usize) -> *mut f32 {
    let bytes = count * core::mem::size_of::<f32>();
    let pages = (bytes + PAGE - 1) / PAGE;
    let prev = memory_grow(0, pages);
    if prev == usize::MAX {
        return core::ptr::null_mut();
    }
    (prev * PAGE) as *mut f32
}

/// Fresh pages arrive zeroed, so this is only needed when reusing a region.
pub fn zero(ptr: *mut f32, count: usize) {
    unsafe {
        for i in 0..count {
            *ptr.add(i) = 0.0;
        }
    }
}
