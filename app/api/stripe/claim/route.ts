import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, userId, email } = await request.json();

    if (!sessionId || !userId || !email) {
      return NextResponse.json(
        { error: "Hiányzó adatok." },
        { status: 400 }
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json(
        { error: "Hiányzó Stripe-beállítás." },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey);

    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      {
        expand: ["subscription"],
      }
    );

    const subscription = session.subscription;

    const subscriptionStatus =
      subscription && typeof subscription !== "string"
        ? subscription.status
        : null;

    const validRole =
      session.metadata?.role === "client" ||
      session.metadata?.role === "coach";

    if (
      session.mode !== "subscription" ||
      session.status !== "complete" ||
      subscriptionStatus !== "active" ||
      !validRole ||
      session.customer_details?.email?.toLowerCase() !==
        email.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Az előfizetés nem érvényes." },
        { status: 403 }
      );
    }

    const supabaseAdmin = createSupabaseAdmin();

    const { data, error } = await supabaseAdmin.rpc(
      "claim_subscription",
      {
        p_checkout_session_id: session.id,
        p_user_id: userId,
        p_email: email,
      }
    );

    if (error) {
      console.error("Előfizetés hozzárendelési hiba:", error);

      return NextResponse.json(
        { error: "Az előfizetést nem sikerült hozzárendelni." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      role: data,
    });
  } catch (error) {
    console.error("Claim API hiba:", error);

    return NextResponse.json(
      { error: "Szerverhiba történt." },
      { status: 500 }
    );
  }
}