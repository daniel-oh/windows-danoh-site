import styles from "./Reel.module.css";

// A vertical (9:16) screen recording for MDX posts, framed in the same
// Win98 window as <SitePreview />. Server component: a plain <video>, no
// client JS.
//
// Deliberate defaults:
//   - preload="none" + a poster. A reel is a few megabytes and most readers
//     never press play, so nothing is fetched until they do.
//   - controls, never autoplay: these have sound.
//   - playsInline, so iOS plays it in the page instead of going fullscreen.
//   - width/height on the element, so the frame is reserved before the
//     poster loads (no layout shift).
//
// Files live under /public/blog/<post>/. Encode for the web first:
//   ffmpeg -i in.mp4 -vf scale=720:-2 -c:v libx264 -crf 26 \
//          -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 96k out.mp4

export type ReelProps = {
  /** Root-relative path to the .mp4, e.g. "/blog/my-post/demo.mp4". */
  src: string;
  /** Root-relative path to the poster frame. */
  poster: string;
  /** Title-bar label, styled as a filename. */
  title: string;
  /** What the recording shows, for people who cannot watch it. */
  alt: string;
  caption?: string;
};

export function Reel({ src, poster, title, alt, caption }: ReelProps) {
  return (
    <figure className={styles.figure}>
      <div className={styles.window}>
        <div className={styles.titleBar}>
          <span className={styles.title}>{title}</span>
          <span className={styles.controls} aria-hidden="true">
            <span className={styles.ctl}>_</span>
            <span className={styles.ctl}>▢</span>
            <span className={styles.ctl}>×</span>
          </span>
        </div>
        <video
          className={styles.video}
          controls
          playsInline
          preload="none"
          poster={poster}
          width={720}
          height={1280}
          aria-label={alt}
        >
          <source src={src} type="video/mp4" />
          <a href={src}>Download the video</a>
        </video>
      </div>
      {caption && <figcaption className={styles.figcaption}>{caption}</figcaption>}
    </figure>
  );
}
