import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/generated/supabase/types";

// Any Database-typed client; in practice the service client from the
// Stripe webhook, since a purchase is credited with no user session.
type Client = SupabaseClient<Database>;

export async function createTransaction({
  client,
  userId,
  amount,
  tokensPurchased,
}: {
  client: Client;
  userId: string;
  amount: number;
  tokensPurchased: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await (client.from("transactions") as any).insert({
      user_id: userId,
      amount: amount,
      tokens_purchased: tokensPurchased,
    });

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error("Error creating transaction:", error);
    return { success: false, error: "Failed to create transaction" };
  }
}
