
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  try {
    const { role } = await request.json();

    // Csak a két előre meghatározott csomag vásárolható meg.
    if (role !== "client" && role !== "coach") {
      return NextResponse.json(
        { error: "Érvénytelen csomag." },
        { status: 400 }
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    const priceId =
      role === "client"
        ? process.env.STRIPE_GUEST_PRICE_ID
        : process.env.STRIPE_COACH_PRICE_ID;

    if (!secretKey || !priceId) {
      return NextResponse.json(
        { error: "Hiányzik a Stripe beállítása." },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey);

    const session = await stripe.checkout.sessions.create({
        managed_payments: { enabled: false },
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        role,
      },
      success_url: `${request.nextUrl.origin}/belepes?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        `${request.nextUrl.origin}/belepes?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Checkout hiba:", error);

    return NextResponse.json(
      { error: "Nem sikerült elindítani a fizetést." },
      { status: 500 }
    );
  }
}