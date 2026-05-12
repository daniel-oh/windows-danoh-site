import Stripe from "stripe";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createTransaction } from "@/server/usage/createTransaction";

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

  const client = await createClient();

  // Idempotency. Stripe retries webhooks on any non-2xx or timeout;
  // without this check, a retried checkout.session.completed would
  // call createTransaction twice and double-credit tokens. We use
  // event.id (Stripe-assigned, globally unique per event, stable
  // across retries) as the dedup key. Inserting into stripe_events
  // is the first DB write — if the PK conflict fires, this event
  // was already processed and we can 200 immediately.
  const { error: dedupError } = await (client.from("stripe_events") as any)
    .insert({ event_id: event.id, type: event.type });

  if (dedupError) {
    // 23505 = unique_violation. Anything else is a genuine DB error
    // that we don't want to silently swallow — fail loud so Stripe
    // retries and we get logs.
    if (dedupError.code === "23505") {
      return Response.json({ received: true, deduped: true });
    }
    console.error("[stripe webhook] dedup insert failed:", dedupError);
    return Response.json(
      { error: "Webhook dedup failed; will retry" },
      { status: 500 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;

    if (!userId) {
      return Response.json({ error: "User ID not found" }, { status: 400 });
    }

    const { error } = await createTransaction({
      client,
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
