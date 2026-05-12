import styles from "./SkipLink.module.css";

// WCAG 2.4.1 Bypass Blocks. Keyboard / screen-reader visitors get a
// "Skip to main content" link as the first focusable element on the
// page, so they don't have to tab through the title-bar chrome and
// the tagline to reach the actual content.
//
// Hidden off-screen by default; slides in on focus with a retro Win98
// grey-button treatment so it reads as part of the site, not a
// generic accessibility artifact. Sighted mouse users never see it.

export function SkipLink({
  href = "#main",
  label = "Skip to main content",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <a href={href} className={styles.skipLink}>
      {label}
    </a>
  );
}
