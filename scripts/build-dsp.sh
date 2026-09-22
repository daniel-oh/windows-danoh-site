#!/usr/bin/env bash
# Builds dsp/ (Rust) to public/dsp/sampler.wasm.
#
# The artifact is committed, like public/rive.wasm, so CI and the Docker build
# need no Rust at all. Run this after changing anything under dsp/, then commit
# the .wasm with the source change. lib/sampler/__test__/dsp.test.ts runs the
# committed binary, so a stale one fails the build.
set -euo pipefail

cd "$(dirname "$0")/.."
OUT=public/dsp/sampler.wasm

if ! command -v rustup >/dev/null 2>&1; then
  echo "rustup not found. Install from https://rustup.rs, then:"
  echo "  rustup target add wasm32-unknown-unknown"
  exit 1
fi

TOOLCHAIN_BIN="$(rustup which cargo | xargs dirname)"
export PATH="$TOOLCHAIN_BIN:$PATH"
export RUSTC="$TOOLCHAIN_BIN/rustc"

# Some rustup installs ship a rust-lld whose libLLVM.dylib is missing (it
# looks for it beside its own bin dir), which only shows up as a link failure.
# When it is absent, use Homebrew's wasm-ld, which links the same objects.
HOST="$(rustc -vV | awk '/^host/{print $2}')"
LLD_DIR="$TOOLCHAIN_BIN/../lib/rustlib/$HOST/bin"
if [ -z "${RUSTFLAGS:-}" ] && [ -x "$LLD_DIR/rust-lld" ] && [ ! -f "$LLD_DIR/../lib/libLLVM.dylib" ]; then
  if [ -x /opt/homebrew/opt/llvm/bin/wasm-ld ]; then
    export RUSTFLAGS="-C linker=/opt/homebrew/opt/llvm/bin/wasm-ld"
  fi
fi

(cd dsp && cargo build --release --target wasm32-unknown-unknown)

mkdir -p public/dsp
cp dsp/target/wasm32-unknown-unknown/release/sampler_dsp.wasm "$OUT"
echo "wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
