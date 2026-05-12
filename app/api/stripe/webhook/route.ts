import Stripe from "stripe";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createTransaction } from "@/server/usage/createTransaction";
import { query, hasDatabase } from "@/lib/db";

let _stripe: Stripe | null = null;
function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = new Stripe(key);
  return _stripe;
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return Response.json(
      { error: "Stripe webhook is not configured." },
      { status: 503 }
    );
  }

  const body = await req.text();
  const signature = (await headers()).get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return Response.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // Idempotency. Stripe retries webhooks on any non-2xx or timeout;
  // without this check, a retried checkout.session.completed would
  // call createTransaction twice and double-credit tokens. Use
  // event.id (Stripe-assigned, globally unique per event, stable
  // across retries) as the dedup key. INSERT ... ON CONFLICT DO
  // NOTHING into the self-hosted Postgres lets us detect a replay
  // via the returned rowCount in a single round-trip.
  //
  // Self-hosted Postgres (lib/db) rather than Supabase: this is
  // operational metadata with no RLS concerns; living next to
  // sessions/generations/guestbook lets it auto-migrate on deploy
  // via ensureTables(). Falls open (no-op) if no DATABASE_URL,
  // matching the rest of the app's posture.
  if (hasDatabase()) {
    const dedup = await query(
      `INSERT INTO stripe_events (event_id, type)
       VALUES ($1, $2)
       ON CONFLICT (event_id) DO NOTHING`,
      [event.id, event.type]
    );
    if (dedup && dedup.rowCount === 0) {
      return Response.json({ received: true, deduped: true });
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;

    if (!userId) {
      return Response.json({ error: "User ID not found" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await createTransaction({
      client: supabase,
      userId,
      amount: session.amount_total!,
      tokensPurchased: 100,
    });

    if (error) {
      console.error("Error updating user tokens:", error);
      return Response.json(
        { error: "Error updating user tokens" },
        { status: 500 }
      );
    }
  }

  return Response.json({ received: true });
}
