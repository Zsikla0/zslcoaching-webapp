
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const menuItems = [
  { name: "Edzésnapló", href: "/edzesnaplo" },
  { name: "Napi napló", href: "/naplo" },
  { name: "Táplálékkiegészítők", href: "/taplalekkiegeszitok" },
  { name: "Vendégeim", href: "/edzoi" },
  { name: "Meghívások", href: "/meghivasok" },
  { name: "Profilom", href: "/profil" },
];

export default function Navigation() {
  const pathname = usePathname();
  const [isCoach, setIsCoach] = useState(false);

useEffect(() => {
  async function checkCoach() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsCoach(false);
      return;
    }

    const { data, error } = await supabase
      .from("coaches")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Edzői jogosultság ellenőrzése:", error);
      return;
    }

    setIsCoach(Boolean(data));
  }

  checkCoach();
}, [pathname]);
  const router = useRouter();

async function handleLogout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert("Nem sikerült kijelentkezni: " + error.message);
    return;
  }

  router.push("/belepes");
  router.refresh();
}

  if (pathname === "/belepes") return null;

  return (
    <nav className="sticky top-0 z-30 border-b border-[#d8b96e]/20 bg-[#111]/90 px-4 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4">
        <Link
          href="/"
          className="mr-4 text-xl font-bold text-[#d8b96e]"
        >
          ZSL COACHING
        </Link>

        
{menuItems.map((item) => {
  // Az edzőnek nincs saját edzésnaplója vagy napi naplója.
  if (
    isCoach &&
    (item.href === "/edzesnaplo" ||
      item.href === "/naplo" ||
      item.href === "/taplalekkiegeszitok" ||
      item.href === "/meghivasok")
  ) {
    return null;
  }

  // A vendég nem látja az edzői vendégkezelést.
  if (!isCoach && item.href === "/edzoi") {
    return null;
  }
          const active =
            pathname === item.href ||
            (item.href === "/edzoi" &&
              pathname.startsWith("/vendeg/"));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-[#d8b96e] font-semibold text-black"
                  : "text-[#ddd] hover:bg-[#333]"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
        <button
  type="button"
  onClick={handleLogout}
  className="ml-auto rounded-lg border border-[#d8b96e] px-4 py-2 text-sm font-semibold text-[#d8b96e] transition hover:bg-[#d8b96e] hover:text-black"
>
  Kijelentkezés
</button>
      </div>
    </nav>
  );
}
