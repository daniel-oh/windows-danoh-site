import { atom, type Atom } from "jotai";
import { unwrap } from "jotai/utils";

const PENDING = Symbol("pending");

// Suspend once, then never again: the first read waits for the source
// like any async atom, and every later refresh keeps handing out the
// last value until the new one resolves. For the filesystem-backed
// atoms, whose readers sit under next/dynamic boundaries with a null
// fallback, a second suspension means a blank window, not a spinner.
export function staleAtom<T>(source: Atom<Promise<T>>): Atom<T | Promise<T>> {
  const settled = unwrap(source, (prev) =>
    prev === undefined ? PENDING : prev
  );
  return atom((get) => {
    const value = get(settled);
    return value === PENDING ? get(source) : (value as T);
  });
}
