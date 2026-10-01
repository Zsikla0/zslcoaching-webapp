
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const pages = [
  {
    title: "Edzésnapló",
    description: "Edzéstervek, súlyok és fejlődés követése.",
    href: "/edzesnaplo",
    icon: "🏋️",
  },
  {
    title: "Napi napló",
    description: "Testsúly, kalória, alvás és lépésszám.",
    href: "/naplo",
    icon: "📊",
  },
  {
    title: "Vendégeim",
    description: "Vendégek edzései és heti átlagai.",
    href: "/edzoi",
    icon: "👥",
  },
  {
    title: "Meghívások",
    description: "Edzői meghívások kezelése.",
    href: "/meghivasok",
    icon: "✉️",
  },
  {
    title: "Profilom",
    description: "Személyes adatok kezelése.",
    href: "/profil",
    icon: "👤",
  },
];

export default function HomePage() {
  const [isCoach, setIsCoach] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

useEffect(() => {
  async function checkCoach() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
  setIsCoach(false);
  setAuthLoading(false);
  window.location.replace("/belepes");
  return;
}

    const { data, error } = await supabase
      .from("coaches")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Edzői jogosultság ellenőrzése:", error);
      setAuthLoading(false);
      return;
    }

    setIsCoach(Boolean(data));
    setAuthLoading(false);
  }

  checkCoach();
}, []);
if (authLoading) {
  return (
    <main className="brand-shell min-h-screen p-8 text-white">
      <p>Bejelentkezés ellenőrzése...</p>
    </main>
  );
}
  return (
    <main className="brand-shell min-h-screen px-5 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold text-[#d8b96e]">
          ZSL Coaching
        </h1>

        <p className="mt-3 text-[#aaa]">
          Edzéseid és fejlődésed egy helyen.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pages
  .filter((page) => {
    if (page.href === "/edzoi") return isCoach;
    if (isCoach && ["/edzesnaplo", "/naplo"].includes(page.href)) {
      return false;
    }
    return true;
  })
  .map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="rounded-3xl border border-[#d8b96e]/20 bg-[#1a1a1a]/95 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:border-[#d8b96e]/50 hover:bg-[#202020]"
            >
              <div className="text-4xl">{page.icon}</div>

              <h2 className="mt-5 text-xl font-bold text-[#d8b96e]">
                {page.title}
              </h2>

              <p className="mt-2 text-sm text-[#aaa]">
                {page.description}
              </p>

              <p className="mt-6 text-sm font-semibold text-[#d8b96e]">
                Megnyitás →
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
