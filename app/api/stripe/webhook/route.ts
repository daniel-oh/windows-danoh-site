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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const client = await createClient();

    if (!userId) {
      return Response.json({ error: "User ID not found" }, { status: 400 });
    }

    if (userId) {
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
  }

  return Response.json({ received: true });
}
