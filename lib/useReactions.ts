"use client";

import { useCallback, useEffect, useState } from "react";

export const REACTIONS = [
  { key: "like", label: "Like", emoji: "👍" },
  { key: "love", label: "Love", emoji: "❤️" },
  { key: "fire", label: "Fire", emoji: "🔥" },
] as const;

export type ReactionKey = (typeof REACTIONS)[number]["key"];
export type ReactionCounts = Record<ReactionKey, number>;

const EMPTY_COUNTS: ReactionCounts = { like: 0, love: 0, fire: 0 };

const VISITOR_KEY = "danoh_visitor";

function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

type State = { counts: ReactionCounts; mine: ReactionKey[] };

export function useReactions(slug: string) {
  const [state, setState] = useState<State>({ counts: EMPTY_COUNTS, mine: [] });
  const [visitorId, setVisitorId] = useState<string>("");

  useEffect(() => {
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
      // Optimistic update
      setState((prev) => {
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
      });
      try {
        const res = await fetch("/api/reactions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, reaction, visitorId }),
        });
        if (res.ok) {
          const data: State = await res.json();
          setState(data);
        }
      } catch {
        /* swallow — optimistic state remains */
      }
    },
    [slug, visitorId]
  );

  return { ...state, toggle };
}
