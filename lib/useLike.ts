"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getVisitorId } from "@/lib/visitorId";

export type LikeState = { count: number; liked: boolean };

// One like per visitor per post. The button flips at once; the request
// carries the state the visitor now sees, so taps in quick succession
// resolve to the last one no matter which reply lands first (replies
// older than the latest tap are ignored).
export function useLike(slug: string) {
  const [state, setState] = useState<LikeState>({ count: 0, liked: false });
  const [loaded, setLoaded] = useState(false);
  const [visitorId, setVisitorId] = useState("");
  const seq = useRef(0);
  // The state as of the last tap, readable synchronously: a setState
  // updater is not guaranteed to have run by the next line.
  const current = useRef(state);
  const show = useCallback((next: LikeState) => {
    current.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    // getVisitorId() also WRITES (localStorage + mirror cookie), so it
    // must run post-render; the sync setState here is the documented
    // price of that, not an accidental cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisitorId(getVisitorId());
  }, []);

  useEffect(() => {
    if (!slug || !visitorId) return;
    const ctrl = new AbortController();
    fetch(
      `/api/reactions?slug=${encodeURIComponent(slug)}&visitorId=${encodeURIComponent(visitorId)}`,
      { signal: ctrl.signal }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data: LikeState | null) => {
        // A tap before the first load wins over the load.
        if (data && seq.current === 0) show(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => ctrl.abort();
  }, [slug, visitorId, show]);

  const toggle = useCallback(() => {
    if (!visitorId) return;
    const mine = ++seq.current;
    const before = current.current;
    const wanted = !before.liked;
    show({ liked: wanted, count: Math.max(0, before.count + (wanted ? 1 : -1)) });
    fetch("/api/reactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, liked: wanted, visitorId }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: LikeState) => {
        if (mine === seq.current) show(data);
      })
      .catch(() => {
        // Only the latest tap may roll back, and only to what it replaced.
        if (mine === seq.current) show(before);
      });
  }, [slug, visitorId, show]);

  return { ...state, loaded, toggle };
}
