"use client";

import { useCallback, useEffect, useState } from "react";
import { getVisitorId } from "@/lib/visitorId";

export const REACTIONS = [
  { key: "like", label: "Like", emoji: "👍" },
  { key: "love", label: "Love", emoji: "❤️" },
  { key: "fire", label: "Fire", emoji: "🔥" },
] as const;

export type ReactionKey = (typeof REACTIONS)[number]["key"];
export type ReactionCounts = Record<ReactionKey, number>;

const EMPTY_COUNTS: ReactionCounts = { like: 0, love: 0, fire: 0 };

type State = { counts: ReactionCounts; mine: ReactionKey[] };

export function useReactions(slug: string) {
  const [state, setState] = useState<State>({ counts: EMPTY_COUNTS, mine: [] });
  const [visitorId, setVisitorId] = useState<string>("");

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
      .then((data: State | null) => {
        if (data) setState({ counts: data.counts, mine: data.mine });
      })
      .catch(() => { /* ignore */ });
    return () => ctrl.abort();
  }, [slug, visitorId]);

  const toggle = useCallback(
    async (reaction: ReactionKey) => {
      if (!visitorId) return;
      // Toggling is its own inverse, so the same updater does both the
      // optimistic apply and the revert when the write doesn't land.
      const applyToggle = (prev: State): State => {
        const hasIt = prev.mine.includes(reaction);
        return {
          counts: {
            ...prev.counts,
            [reaction]: Math.max(0, prev.counts[reaction] + (hasIt ? -1 : 1)),
          },
          mine: hasIt
            ? prev.mine.filter((r) => r !== reaction)
            : [...prev.mine, reaction],
        };
      };
      setState(applyToggle);
      try {
        const res = await fetch("/api/reactions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, reaction, visitorId }),
        });
        if (res.ok) {
          const data: State = await res.json();
          setState(data);
        } else {
          setState(applyToggle);
        }
      } catch {
        setState(applyToggle);
      }
    },
    [slug, visitorId]
  );

  return { ...state, toggle };
}
