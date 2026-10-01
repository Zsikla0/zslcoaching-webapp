
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const sessionId =
    request.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Hiányzó fizetési azonosító." },
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

  try {
    const stripe = new Stripe(secretKey);

    const session =
      await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });

    const subscription = session.subscription;

    const subscriptionStatus =
      subscription && typeof subscription !== "string"
        ? subscription.status
        : null;

    const validRole =
      session.metadata?.role === "client" ||
      session.metadata?.role === "coach";

    const verified =
      session.mode === "subscription" &&
      session.status === "complete" &&
      subscriptionStatus === "active" &&
      validRole;

    if (!verified) {
      return NextResponse.json(
        { verified: false },
        { status: 403 }
      );
    }

    return NextResponse.json({
      verified: true,
      role: session.metadata?.role,
    });
  } catch (error) {
    console.error("Stripe ellenőrzési hiba:", error);

    return NextResponse.json(
      { error: "Nem sikerült ellenőrizni a fizetést." },
      { status: 500 }
    );
  }
}