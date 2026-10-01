
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error("Hiányzó Stripe webhook beállítás.");
    return NextResponse.json(
      { error: "Hiányzó Stripe beállítás." },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Hiányzó Stripe aláírás." },
      { status: 400 }
    );
  }

  const stripe = new Stripe(secretKey);
  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch {
    console.error("Érvénytelen Stripe webhook aláírás.");

    return NextResponse.json(
      { error: "Érvénytelen aláírás." },
      { status: 400 }
    );
  }

  switch (event.type) {
    
case "checkout.session.completed": {
  const session = event.data.object as Stripe.Checkout.Session;

  const role = session.metadata?.role;

  // Csak a ZSL Coaching saját vásárlásait dolgozzuk fel.
  if (role !== "client" && role !== "coach") {
    console.log("Ismeretlen csomag, kihagyva:", event.id);
    break;
  }

  if (!session.subscription || !session.customer) {
    throw new Error("Hiányzó Stripe előfizetés vagy vásárló.");
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer.id;

  // A tényleges előfizetési állapotot a Stripe-tól kérjük le.
  const subscription =
    await stripe.subscriptions.retrieve(subscriptionId);

  const supabaseAdmin = createSupabaseAdmin();

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .upsert(
      {
        email: session.customer_details?.email ?? null,
        role,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_checkout_session_id: session.id,
        status: subscription.status,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "stripe_checkout_session_id",
      }
    );

  if (error) {
    console.error("Supabase mentési hiba:", error.message);
    throw error;
  }

  console.log("Előfizetés elmentve:", subscriptionId);
  break;
}

    
case "customer.subscription.created":
case "customer.subscription.updated":
case "customer.subscription.deleted": {
  const subscription = event.data.object as Stripe.Subscription;

  const supabaseAdmin = createSupabaseAdmin();

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("Előfizetés frissítési hiba:", error.message);
    throw error;
  }

  console.log(
    "Előfizetés állapota frissítve:",
    subscription.id,
    subscription.status
  );

  break;
}

    case "invoice.paid":
    case "invoice.payment_failed":
      console.log("Számlázási esemény:", event.type, event.id);
      break;

    default:
      console.log("Egyéb Stripe esemény:", event.type);
  }

  return NextResponse.json({ received: true });
}