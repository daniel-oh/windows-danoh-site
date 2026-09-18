import type { ComponentPropsWithoutRef } from "react";
import styles from "@/app/blog/blog.module.css";

// Every markdown table in a post renders through this (registry.tsx maps
// `table` to it). Wide tables scroll sideways on a phone, and a region
// that scrolls must be reachable from the keyboard, so the wrapper is
// focusable and named. The <table> itself is untouched.
export function ScrollTable(props: ComponentPropsWithoutRef<"table">) {
  return (
    <div
      className={styles.tableScroll}
      tabIndex={0}
      role="region"
      aria-label="Table. Scrolls sideways if it is wider than the page."
    >
      <table {...props} />
    </div>
  );
}
