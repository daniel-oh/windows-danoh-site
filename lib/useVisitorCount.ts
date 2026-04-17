"use client";

import { useEffect, useState } from "react";
import { getVisitorId } from "@/lib/visitorId";

// Shared in-flight promise so multiple components calling this hook in
// parallel don't each POST on mount.
let pending: Promise<number | null> | null = null;

async function recordVisit(): Promise<number | null> {
  if (pending) return pending;
  pending = (async () => {
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visitorId: getVisitorId() }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { total?: number };
      return typeof data.total === "number" ? data.total : null;
    } catch {
      return null;
    }
  })();
  return pending;
}

export function useVisitorCount() {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    recordVisit().then((n) => {
      if (!cancelled && n !== null) setTotal(n);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return total;
}
