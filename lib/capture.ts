import { createClient } from "@/lib/supabase/server";
import { PostHog } from "posthog-node";
import { isLocal } from "./isLocal";
import { getClientIP } from "./api/clientIP";

type AIEvent = {
  type: "chat" | "icon" | "name" | "program" | "help";
  usedOwnKey: boolean;
  model: string;
};

/**
 * Core server-side capture. Generic by name + properties so any event
 * (rate-limit hit, AI usage, future) can flow through one path. Always
 * a no-op in local dev or when PostHog isn't configured.
 *
 * distinctId defaults to the visitor's IP, which is the right grouping
 * for anonymous events (cost-guard hits, traffic). For authenticated
 * AI calls we override with the Supabase user ID — see `capture()`
 * below.
 *
 * Telemetry must never fail the request path; everything is wrapped
 * in try/catch and we always shutdown the client even on error.
 */
export async function captureServerEvent(
  event: string,
  properties: Record<string, unknown>,
  req: Request,
  options?: { distinctId?: string }
): Promise<void> {
  // Gate on key presence, NOT isLocal(): the deployed container runs
  // with NEXT_PUBLIC_LOCAL_MODE=true (that flag selects the auth
  // layer, not the environment), and gating on it silently disabled
  // all server telemetry in prod — including cost_guard_hit, the one
  // signal that says someone is hammering the AI endpoints. Dev boxes
  // without PostHog keys still no-op here.
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) return;
  let posthog: PostHog | null = null;
  try {
    posthog = new PostHog(key, { host });
    const ip = getClientIP(req);
    const country = req.headers.get("X-Vercel-IP-Country") || "unknown";
    posthog.capture({
      event,
      properties: { ...properties, ip, country },
      distinctId: options?.distinctId ?? ip,
    });
  } catch (err) {
    console.warn("[captureServerEvent] send failed:", err);
  } finally {
    try {
      await posthog?.shutdown();
    } catch {
      /* ignore shutdown errors */
    }
  }
}

/**
 * Typed AI-event helper that builds on captureServerEvent. Looks up
 * the Supabase user to attach the event to a known identity instead
 * of an IP, and ensures the typed event shape (usedOwnKey, model)
 * stays consistent across /api/program, /chat, /help, /name, /icon.
 */
export async function capture(event: AIEvent, req: Request): Promise<void> {
  // The Supabase user lookup only exists outside local mode; the
  // deployed container runs in local mode where auth is bypassed, so
  // fall back to IP grouping there instead of skipping the event.
  let userId: string | undefined;
  if (!isLocal()) {
    const supabase = await createClient();
    const user = await supabase.auth.getUser();
    userId = user.data.user?.id;
  }
  const { type, ...props } = event;
  await captureServerEvent(
    type,
    props,
    req,
    userId ? { distinctId: userId } : undefined
  );
}
