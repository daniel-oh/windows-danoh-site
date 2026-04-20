import { createClient } from "@/lib/supabase/server";
import { PostHog } from "posthog-node";
import { isLocal } from "./isLocal";
import { getClientIP } from "./api/clientIP";

type Event = {
  type: "chat" | "icon" | "name" | "program" | "help";
  usedOwnKey: boolean;
  model: string;
};

export async function capture(event: Event, req: Request) {
  if (isLocal()) {
    return;
  }

  const supabase = await createClient();
  const user = await supabase.auth.getUser();
  const { type, ...props } = event;
  const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
  });

  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const country = req.headers.get("X-Vercel-IP-Country") || "unknown";

  posthog.capture({
    event: type,
    properties: {
      ...props,
      ip,
      country,
    },
    distinctId: user.data.user?.id ?? "null",
  });
  await posthog.shutdown();
}

/**
 * Lightweight server-side event capture for things that don't fit
 * the typed `capture(event: Event, req)` above (e.g. rate-limit hits,
 * which don't have a usedOwnKey/model). No Supabase dependency so a
 * guard path can't fail the request on auth-lookup failure. Distinct
 * ID is the IP since cap hits typically come from anonymous visitors.
 * No-ops when PostHog is not configured or in local dev.
 */
export async function captureServerEvent(
  event: string,
  properties: Record<string, unknown>,
  req: Request
): Promise<void> {
  if (isLocal()) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) return;
  try {
    const posthog = new PostHog(key, { host });
    const ip = getClientIP(req);
    posthog.capture({
      event,
      properties: { ...properties, ip },
      distinctId: ip,
    });
    await posthog.shutdown();
  } catch (err) {
    // Telemetry must never fail the request path.
    console.warn("[captureServerEvent] send failed:", err);
  }
}
