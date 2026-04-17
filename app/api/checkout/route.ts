import { getUser } from "@/lib/auth/getUser";
import { redirect } from "next/navigation";

import Stripe from "stripe";

let _stripe: Stripe | null = null;
function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = new Stripe(key);
  return _stripe;
}

export async function POST(): Promise<Response> {
  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_PRICE_ID) {
    return new Response("Checkout is not configured.", { status: 503 });
  }
  const user = await getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}`,
    metadata: {
      userId: user.id,
    },
  });

  return redirect(session.url!);
}
