
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"coach" | "client">("client");
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
const [verifiedCheckout, setVerifiedCheckout] = useState(false);

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");

  if (params.get("checkout") !== "success" || !sessionId) {
    return;
  }

  let cancelled = false;

  async function verifyPayment() {
    setLoading(true);
    setMessage("Fizetés ellenőrzése...");

    try {
      const response = await fetch(
        `/api/stripe/verify?session_id=${encodeURIComponent(sessionId!)}`
      );

      const data = await response.json();

      if (!response.ok || !data.verified) {
        throw new Error("Nem sikerült igazolni az előfizetést.");
      }

      if (cancelled) return;

      setRole(data.role);
      setActiveTab("register");
      setVerifiedCheckout(true);
      setMessage(
        "Sikeres fizetés! Az előfizetésed ellenőrizve."
      );
    } catch (error) {
      if (cancelled) return;

      setMessage(
        error instanceof Error
          ? error.message
          : "Fizetésellenőrzési hiba."
      );
    } finally {
      if (!cancelled) setLoading(false);
    }
  }

  verifyPayment();

  return () => {
    cancelled = true;
  };
}, []);

  
async function signIn() {
  setLoading(true);
  setMessage("");

  try {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error("Nem sikerült bejelentkezni.");
    }

    // Megnézzük, hogy a felhasználó edző-e.
    const { data: coach, error: coachError } =
      await supabase
        .from("coaches")
        .select("user_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

    if (coachError) {
      throw new Error(coachError.message);
    }

    if (coach) {
      // Edző: vendégek kezelése.
      window.location.replace("/edzoi");
    } else {
      // Vendég: saját edzésnapló.
      window.location.replace("/edzesnaplo");
    }
  } catch (error) {
    setMessage(
      error instanceof Error
        ? error.message
        : "Bejelentkezési hiba."
    );
  } finally {
    setLoading(false);
  }
}

  async function signUp() {
  setLoading(true);
  setMessage("");

  if (!verifiedCheckout) {
    setMessage("Először válaszd ki a csomagot és végezd el a fizetést.");
    setLoading(false);
    return;
  }

  if (password !== confirmPassword) {
    setMessage("A két jelszó nem egyezik meg!");
    setLoading(false);
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: role,
      },
    },
  });
  if (!error) {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");

  if (!sessionId) {
    setMessage("Hiányzik a Stripe fizetés azonosítója.");
    setLoading(false);
    return;
  }

  const user = data.user;

if (!user) {
  setMessage(
    "A fiók létrehozása megtörtént, de a felhasználó azonosítása sikertelen."
  );
  setLoading(false);
  return;
}

  const claimResponse = await fetch(
    "/api/stripe/claim",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        userId: user.id,
        email: user.email,
      }),
    }
  );

  const claimData = await claimResponse.json();

  if (!claimResponse.ok || !claimData.success) {
    setMessage(
      claimData.error ||
        "A fizetés összekapcsolása nem sikerült."
    );
    setLoading(false);
    return;
  }
}

  setLoading(false);

  setMessage(
    error
      ? error.message
      : "Regisztráció elküldve. Ha szükséges, erősítsd meg az e-mail-címedet."
  );

  if (!error) {
    setActiveTab("login");
    setConfirmPassword("");
  }
}

async function startCheckout() {
  setLoading(true);
  setMessage("");

  try {
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role }),
    });

    const data = await response.json();

    if (!response.ok || !data.url) {
      throw new Error(
        data.error || "Nem sikerült elindítani a fizetést."
      );
    }

    // Átirányítás a Stripe biztonságos fizetési oldalára
    window.location.assign(data.url);
  } catch (error) {
    setMessage(
      error instanceof Error
        ? error.message
        : "Hiba történt a fizetés indításakor."
    );
    setLoading(false);
  }
}
  return (
    
<main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090909] bg-[url('/login-bg.png')] bg-cover bg-center bg-no-repeat px-4 py-12 text-white">
{/* Sötétítő réteg a háttérképen */}
<div className="pointer-events-none absolute inset-0 bg-black/65" />
  {/* Visszafogott arany háttérfény */}
  <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#d8b96e]/10 blur-[110px]" />

  <section className="relative z-10 w-full max-w-md rounded-3xl border border-[#d8b96e]/25 bg-[#1a1a1a]/95 p-7 shadow-[0_25px_90px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-9">
        <h1 className="text-center text-3xl font-bold tracking-widest text-[#d8b96e]">
          ZSL COACHING
        </h1>

        
<p className="mt-3 text-center text-sm text-[#aaa]">
  Edzésnapló és online coaching
</p>


<div className="mb-8 mt-8 grid grid-cols-2 gap-1 rounded-2xl border border-[#383838] bg-[#111] p-1.5">
  <button
    type="button"
    onClick={() => {
      setActiveTab("login");
      setMessage("");
    }}
    className={`rounded-xl px-3 py-3.5 text-sm font-bold transition-all duration-200 ${
      activeTab === "login"
        ? "bg-[#d8b96e] text-[#111] shadow-[0_4px_18px_rgba(216,185,110,0.2)]"
        : "text-[#888] hover:bg-[#242424] hover:text-white"
    }`}
  >
    Bejelentkezés
  </button>

  <button
    type="button"
    onClick={() => {
      setActiveTab("register");
      setMessage("");
    }}
    className={`rounded-xl px-3 py-3.5 text-sm font-bold transition-all duration-200 ${
      activeTab === "register"
        ? "bg-[#d8b96e] text-[#111] shadow-[0_4px_18px_rgba(216,185,110,0.2)]"
        : "text-[#888] hover:bg-[#242424] hover:text-white"
    }`}
  >
    Regisztráció
  </button>
</div>
        

{activeTab === "register" && (
  <div className="mb-7">
    <p className="mb-3 text-sm font-semibold text-[#ddd]">
      Milyen fiókot szeretnél?
    </p>

    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => setRole("coach")}
        aria-pressed={role === "coach"}
        className={`flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition-all ${
          role === "coach"
            ? "border-[#d8b96e] bg-[#d8b96e]/10 shadow-[0_0_20px_rgba(216,185,110,0.12)]"
            : "border-[#393939] bg-[#242424] hover:border-[#777]"
        }`}
      >
        <span className="text-3xl">🏋️</span>
        <span
          className={`font-bold ${
            role === "coach" ? "text-[#d8b96e]" : "text-white"
          }`}
        >
          Edző vagyok
        </span>
        <span className="text-xs text-[#aaa]">
          Vendégek és edzéstervek kezelése
        </span>
      </button>

      <button
        type="button"
        onClick={() => setRole("client")}
        aria-pressed={role === "client"}
        className={`flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition-all ${
          role === "client"
            ? "border-[#d8b96e] bg-[#d8b96e]/10 shadow-[0_0_20px_rgba(216,185,110,0.12)]"
            : "border-[#393939] bg-[#242424] hover:border-[#777]"
        }`}
      >
        <span className="text-3xl">💪</span>
        <span
          className={`font-bold ${
            role === "client" ? "text-[#d8b96e]" : "text-white"
          }`}
        >
          Vendég vagyok
        </span>
        <span className="text-xs text-[#aaa]">
          Saját edzésnapló és fejlődéskövetés
        </span>
      </button>
    </div>
  </div>
)}
        
<div className="mb-5">
  <label
    htmlFor="email"
    className="mb-2 block text-sm font-semibold text-[#ddd]"
  >
    E-mail-cím
  </label>

  <input
    id="email"
    type="email"
    autoComplete="email"
    placeholder="pelda@email.com"
    value={email}
    onChange={(event) => setEmail(event.target.value)}
    className="w-full rounded-xl border border-[#393939] bg-[#111] px-4 py-3.5 text-white placeholder:text-[#666] outline-none transition-all duration-200 focus:border-[#d8b96e] focus:shadow-[0_0_0_3px_rgba(216,185,110,0.1)]"
  />
</div>


<div className="mb-6">
  <label
    htmlFor="password"
    className="mb-2 block text-sm font-semibold text-[#ddd]"
  >
    Jelszó
  </label>

  <div className="relative">
    <input
      id="password"
      type={showPassword ? "text" : "password"}
      autoComplete={
        activeTab === "register"
          ? "new-password"
          : "current-password"
      }
      placeholder="Add meg a jelszavad"
      value={password}
      onChange={(event) => setPassword(event.target.value)}
      className="w-full rounded-xl border border-[#393939] bg-[#111] px-4 py-3.5 pr-14 text-white placeholder:text-[#666] outline-none transition-all duration-200 focus:border-[#d8b96e] focus:shadow-[0_0_0_3px_rgba(216,185,110,0.1)]"
    />

    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      aria-label={
        showPassword ? "Jelszó elrejtése" : "Jelszó megjelenítése"
      }
      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#999] transition hover:text-[#d8b96e]"
    >
      {showPassword ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5 0 9 4 10 7a13 13 0 0 1-3.2 4.5" />
          <path d="M6.2 6.2C4.3 7.5 2.8 9.5 2 12c1 3 5 7 10 7 1.5 0 2.9-.4 4.1-1" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  </div>
</div>
        
{activeTab === "register" && (
  <div className="mb-6">
    <label className="mb-2 block text-sm">
      Jelszó megerősítése
    </label>

    <input
      type="password"
      autoComplete="new-password"
      value={confirmPassword}
      onChange={(event) =>
        setConfirmPassword(event.target.value)
      }
      placeholder="Írd be újra a jelszavad"
      className="w-full rounded-xl border border-[#393939] bg-[#111] px-4 py-3.5 text-white placeholder:text-[#666] outline-none transition-all duration-200 focus:border-[#d8b96e] focus:shadow-[0_0_0_3px_rgba(216,185,110,0.1)]"
    />
  </div>
)}

        
{activeTab === "login" ? (
  <button
    type="button"
    onClick={signIn}
    disabled={loading}
    className="w-full rounded-xl bg-gradient-to-r from-[#c9a65b] via-[#e8cc89] to-[#c9a65b] px-5 py-4 font-bold text-[#111] shadow-[0_6px_24px_rgba(216,185,110,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(216,185,110,0.35)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {loading ? "Bejelentkezés..." : "Bejelentkezés"}
  </button>
) : (
  
<button
  type="button"
  onClick={verifiedCheckout ? signUp : startCheckout}
  disabled={loading}
  className="w-full rounded-xl bg-gradient-to-r from-[#c9a65b] via-[#e8cc89] to-[#c9a65b] px-5 py-4 font-bold text-[#111] shadow-[0_6px_24px_rgba(216,185,110,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(216,185,110,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
>
  {loading
    ? "Fizetési oldal megnyitása..."
    : verifiedCheckout
  ? "Regisztráció befejezése"
  : role === "client"
    ? "Előfizetés – 25 000 Ft / hó"
    : "Előfizetés – 20 000 Ft / hó"
      }
</button>
)}

        {message && (
          <p className="mt-5 text-center text-sm text-[#d8b96e]">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}